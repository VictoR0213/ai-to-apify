import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { QuotaForge } from './service.mjs';
import { example } from './spec.mjs';
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);
async function readJSON(request) {
  if (!(request.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('Use application/json.'), { statusCode: 415 });
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 512000) throw Object.assign(new Error('Request body exceeds 500 KB.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new Error('Invalid JSON request.'); }
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function createServer({ service = new QuotaForge() } = {}) {
  const csrfToken = randomBytes(32).toString('hex');
  const server = http.createServer(async (request, response) => {
    const port = server.address()?.port;
    const allowedHosts = ['127.0.0.1:' + port, 'localhost:' + port];
    const origin = request.headers.origin;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    response.setHeader('Cache-Control', 'no-store');
    const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
    if (!allowedHosts.includes(request.headers.host) || (origin && !allowedHosts.map((host) => 'http://' + host).includes(origin))) {
      return json(403, { error: 'Only same-origin loopback requests are allowed.' });
    }
    try {
      const url = new URL(request.url, 'http://127.0.0.1:' + port);
      if (request.method === 'GET' && staticFiles.has(url.pathname)) {
        const [file, type] = staticFiles.get(url.pathname);
        const content = await readFile(new URL('../public/' + file, import.meta.url));
        response.writeHead(200, { 'Content-Type': type }); response.end(content); return;
      }
      if (request.method === 'GET' && url.pathname === '/api/state') return json(200, { ...await service.state(), csrfToken });
      if (request.method === 'GET' && url.pathname === '/api/example') return json(200, example);
      const artifact = url.pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/artifact$/);
      if (request.method === 'GET' && artifact) return json(200, await service.artifact(artifact[1]));
      if (request.method !== 'POST') return json(404, { error: 'Route not found.' });
      if (!equal(request.headers['x-qf-token'], csrfToken)) return json(403, { error: 'Session expired or missing. Reload the page.' });
      const body = await readJSON(request);
      if (url.pathname === '/api/projects') return json(201, await service.create(body));
      if (url.pathname === '/api/demo') return json(201, await service.demo());
      if (url.pathname === '/api/ledger') return json(201, await service.addEntry(body));
      const action = url.pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/(generate|test|deploy|publish|sync|smoke)$/);
      if (action) {
        const [, id, operation] = action;
        if (operation === 'generate') return json(200, await service.generate(id, body.provider));
        if (operation === 'test') return json(200, await service.test(id));
        if (operation === 'deploy') return json(200, await service.deploy(id, body.confirm));
        if (operation === 'smoke') return json(200, await service.smoke(id, body.confirm));
        if (operation === 'publish') return json(200, await service.publish(id, body.confirm));
        return json(200, await service.sync(id));
      }
      return json(404, { error: 'Route not found.' });
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      json(error.statusCode || 400, { error: String(error.message || 'Operation failed.').replace(/apify_api_[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 2000), ...(error.code ? { code: error.code } : {}) });
    }
  });
  server.requestTimeout = 240000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
export async function startServer({ port = Number(process.env.PORT || 4317), service } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  const server = createServer({ service });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
