import test from 'node:test';
import assert from 'node:assert/strict';
import { ApifyClient } from '../src/adapters/apify.mjs';
import { buildProviderArgs, generateSpec, parseProviderOutput, runProcess } from '../src/adapters/providers.mjs';

const response = (data, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
const token = 'test-only-secret-token';

function stubClient(handler, options = {}) {
  const calls = [];
  const client = new ApifyClient({ token, ...options, fetchImpl: async (url, init) => {
    calls.push({ url: new URL(url), init });
    return handler(url, init, calls.length);
  } });
  return { client, calls };
}

test('Actor creation sends private SOURCE_FILES and bearer authentication only to Apify', async () => {
  const { client, calls } = stubClient(() => response({ id: 'actor123', isPublic: false }, 201));
  const actor = await client.createActor({ name: 'public-feed-reader', title: 'Public Feed Reader', description: 'Read public feeds.', files: { 'src/main.mjs': 'export const main = true;', '.actor/actor.json': '{}' } });
  assert.equal(actor.id, 'actor123');
  const call = calls[0];
  assert.equal(call.url.href, 'https://api.apify.com/v2/actors');
  assert.equal(call.init.headers.Authorization, `Bearer ${token}`);
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.url.search, '');
  const body = JSON.parse(call.init.body);
  assert.equal(body.isPublic, false);
  assert.equal(body.versions[0].sourceType, 'SOURCE_FILES');
  assert.equal(body.versions[0].versionNumber, '0.1');
  assert.equal(body.versions[0].sourceFiles[0].format, 'TEXT');
  assert.equal(body.defaultRunOptions.restartOnError, false);
});

test('Apify rejects path traversal and malformed identifiers before sending a request', async () => {
  const { client, calls } = stubClient(() => response({}));
  assert.throws(() => client.getRun('../secrets'), { code: 'INVALID_ID' });
  assert.throws(() => client.createActor({ name: 'valid-name', title: 'Example', description: '', files: { '../escape': 'x' } }), { code: 'INVALID_FILES' });
  assert.throws(() => client.createActor({ name: 'valid-name', title: 'Example', description: '', files: [{ name: 'same', content: '' }, { name: 'same', content: '' }] }), { code: 'INVALID_FILES' });
  assert.equal(calls.length, 0);
});

test('Build, publish, run, and status calls use the documented endpoints', async () => {
  const { client, calls } = stubClient(() => response({ id: 'id123' }));
  await client.buildActor('actor123');
  await client.getBuild('build123');
  await client.publishActor('actor123');
  await client.runActor('actor123', { url: 'https://example.com/feed' });
  await client.getRun('run123');
  assert.equal(calls[0].url.pathname, '/v2/actors/actor123/builds');
  assert.equal(calls[0].url.searchParams.get('version'), '0.1');
  assert.equal(calls[1].url.pathname, '/v2/actor-builds/build123');
  assert.equal(calls[2].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[2].init.body), { isPublic: true });
  assert.equal(calls[3].url.pathname, '/v2/actors/actor123/runs');
  assert.equal(calls[4].url.pathname, '/v2/actor-runs/run123');
});

test('Run pagination is bounded and follows offsets', async () => {
  const { client, calls } = stubClient((url) => {
    const u = new URL(url);
    const offset = Number(u.searchParams.get('offset'));
    const limit = Number(u.searchParams.get('limit'));
    return response({ total: 10000, items: Array.from({ length: limit }, (_, i) => ({ id: String(offset + i) })) });
  }, { maxItems: 125 });
  const runs = await client.listRuns('actor123');
  assert.equal(runs.length, 125);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('offset'), '100');
  assert.equal(calls[1].url.searchParams.get('limit'), '25');
});

test('Dataset pagination returns raw items and stops after the last page', async () => {
  const { client, calls } = stubClient(() => new Response(JSON.stringify([{ name: 'one' }])));
  assert.deepEqual(await client.getDatasetItems('dataset123'), [{ name: 'one' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/v2/datasets/dataset123/items');
});

test('Apify never retries a failed mutation and never echoes error body secrets', async () => {
  const { client, calls } = stubClient(() => new Response(token, { status: 500 }));
  await assert.rejects(client.buildActor('actor123'), (error) => {
    assert.equal(error.code, 'APIFY_HTTP');
    assert.equal(error.outcomeUnknown, true);
    assert.ok(!error.message.includes(token));
    return true;
  });
  assert.equal(calls.length, 1);
});

test('Network failures redact underlying errors and preserve unknown mutation outcome', async () => {
  const { client } = stubClient(() => { throw new Error(`Network failed with ${token}`); });
  await assert.rejects(client.publishActor('actor123'), (error) => {
    assert.equal(error.code, 'APIFY_NETWORK');
    assert.equal(error.outcomeUnknown, true);
    assert.ok(!error.message.includes(token));
    return true;
  });
});

test('Apify requests time out and caller cancellation aborts the fetch', async () => {
  const hang = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const { client } = stubClient(hang, { timeoutMs: 25 });
  await assert.rejects(client.getRun('run123'), { code: 'TIMEOUT' });
  const controller = new AbortController();
  const { client: cancellable } = stubClient(hang);
  const pending = cancellable.buildActor('actor123', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: 'ABORTED', outcomeUnknown: true });
});

test('Apify rejects pre-cancelled requests without any network activity', async () => {
  const { client, calls } = stubClient(() => response({}));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.getRun('run123', { signal: controller.signal }), { code: 'ABORTED' });
  assert.equal(calls.length, 0);
});

test('Apify rejects malformed and oversized response bodies', async () => {
  const { client } = stubClient(() => new Response('{invalid'));
  await assert.rejects(client.getRun('run123'), { code: 'INVALID_RESPONSE' });
  const { client: oversized } = stubClient(() => new Response('{}', { headers: { 'content-length': String(11 * 1024 * 1024) } }));
  await assert.rejects(oversized.getRun('run123'), { code: 'RESPONSE_LIMIT' });
});

test('Provider parsing accepts structured JSON and rejects prose or error envelopes', () => {
  assert.deepEqual(parseProviderOutput('codex', '{"name":"example"}'), { name: 'example' });
  assert.deepEqual(parseProviderOutput('claude', '{"type":"result","subtype":"success","structured_output":{"name":"example"}}'), { name: 'example' });
  assert.deepEqual(parseProviderOutput('claude', JSON.stringify({ result: JSON.stringify({ name: 'example' }) })), { name: 'example' });
  assert.throws(() => parseProviderOutput('codex', '```json\n{}\n```'), { code: 'INVALID_JSON' });
  assert.throws(() => parseProviderOutput('codex', '[]'), { code: 'INVALID_JSON' });
  assert.throws(() => parseProviderOutput('claude', '{"is_error":true,"result":"{}"}'), { code: 'PROVIDER_FAILED' });
});

test('Native process transport sends prompts through stdin without shell expansion', async () => {
  const input = 'literal $(not-a-command) & "quotes"\n';
  const result = await runProcess(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input, timeoutMs: 3000 });
  assert.equal(result.stdout, input);
});

test('Native process transport hides publishing credentials from the child', async () => {
  const previous = process.env.APIFY_TOKEN;
  process.env.APIFY_TOKEN = token;
  try {
    const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(String(process.env.APIFY_TOKEN === undefined))']);
    assert.equal(result.stdout, 'true');
  } finally {
    if (previous === undefined) delete process.env.APIFY_TOKEN; else process.env.APIFY_TOKEN = previous;
  }
});

test('Native process errors never expose raw stderr', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', `process.stderr.write(${JSON.stringify(token)});process.exit(3)`]), (error) => {
    assert.equal(error.code, 'PROVIDER_FAILED');
    assert.ok(!error.message.includes(token));
    return true;
  });
});

test('Native process transport bounds output and terminates a timed-out process', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(50000))'], { maxOutputBytes: 1000, timeoutMs: 3000 }), { code: 'OUTPUT_LIMIT' });
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 100 }), { code: 'TIMEOUT' });
});

test('Native process transport supports cancellation before and during execution', async () => {
  const controller = new AbortController();
  const pending = runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(pending, { code: 'ABORTED' });
  await assert.rejects(runProcess(process.execPath, ['--version'], { signal: controller.signal }), { code: 'ABORTED' });
});

test('Generation rejects unsupported providers and unenforceable Codex dollar budgets', async () => {
  await assert.rejects(generateSpec({ provider: 'unknown', prompt: 'Example', schema: {} }), { code: 'INVALID_PROVIDER' });
  await assert.rejects(generateSpec({ provider: 'codex', prompt: 'Example', schema: {}, maxBudgetUsd: 1 }), { code: 'UNSUPPORTED_BUDGET' });
});


test('Native process transport removes web-session and unrelated service credentials', async () => {
  process.env.QF_TEST_SESSION_TOKEN = 'not-a-real-session';
  process.env.UNRELATED_TEST_SECRET = 'not-a-real-service-secret';
  try {
    const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(String(process.env.QF_TEST_SESSION_TOKEN === undefined && process.env.UNRELATED_TEST_SECRET === undefined))']);
    assert.equal(result.stdout, 'true');
  } finally {
    delete process.env.QF_TEST_SESSION_TOKEN;
    delete process.env.UNRELATED_TEST_SECRET;
  }
});

test('Apify timeout also cancels a stalled response body', async () => {
  let cancelled = false;
  const { client } = stubClient(() => new Response(new ReadableStream({ cancel() { cancelled = true; } })), { timeoutMs: 25 });
  await assert.rejects(client.getRun('run123'), { code: 'TIMEOUT' });
  assert.equal(cancelled, true);
});

test('Publication pins the tested immutable build with bounded default run options', async () => {
  const { client, calls } = stubClient(() => response({ id: 'actor123', isPublic: true }));
  await client.publishActor('actor123', { buildNumber: '0.1.17' });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    isPublic: true,
    defaultRunOptions: { build: '0.1.17', timeoutSecs: 120, memoryMbytes: 256, restartOnError: false },
  });
  for (const buildNumber of ['latest', '0.1', '0.1.1?x=y', 1, null]) {
    assert.throws(() => client.publishActor('actor123', { buildNumber }), { code: 'INVALID_BUILD' });
  }
  assert.equal(calls.length, 1);
});

test('Actor identity can be read before checking build ownership', async () => {
  const { client, calls } = stubClient(() => response({ id: 'actor123', username: 'owner', name: 'example' }));
  assert.deepEqual(await client.getActor('actor123'), { id: 'actor123', username: 'owner', name: 'example' });
  assert.equal(calls[0].url.href, 'https://api.apify.com/v2/actors/actor123');
  assert.equal(calls[0].init.method, 'GET');
});

test('provider arguments isolate configuration and disable generation tools', () => {
  const schemaPath = 'directory with spaces/schema.json';
  const outputPath = 'directory with spaces/result.json';
  const codex = buildProviderArgs('codex', { schemaPath, outputPath });
  assert.equal(codex[0], 'exec');
  for (const required of ['--ignore-user-config', '--json', '--ephemeral', '-']) assert.ok(codex.includes(required));
  assert.equal(codex[codex.indexOf('--output-schema') + 1], schemaPath);
  assert.equal(codex[codex.indexOf('--output-last-message') + 1], outputPath);
  assert.equal(codex[codex.indexOf('-s') + 1], 'read-only');
  const disabled = new Set(codex.flatMap((arg, index) => arg === '--disable' ? [codex[index + 1]] : []));
  for (const feature of ['shell_tool', 'unified_exec', 'view_image', 'apps', 'plugins', 'multi_agent', 'browser_use', 'computer_use', 'hooks', 'code_mode_host', 'workspace_dependencies']) assert.ok(disabled.has(feature), feature);
  assert.ok(codex.includes('web_search="disabled"'));
  const claude = buildProviderArgs('claude', { schemaText: '{}', maxBudgetUsd: 0.5 });
  assert.equal(claude.includes('--ignore-user-config'), false);
  assert.equal(claude[claude.indexOf('--tools') + 1], '');
  assert.deepEqual(claude.slice(-2), ['--max-budget-usd', '0.5']);
});

test('Actor runs can pin an immutable build and reject invalid build identifiers', async () => {
  const { client, calls } = stubClient(() => response({ id: 'run-pinned' }));
  const run = await client.runActor('actor1', { records: ['fixture'] }, { buildNumber: '0.1.12' });
  assert.equal(run.id, 'run-pinned');
  assert.equal(calls[0].url.searchParams.get('build'), '0.1.12');
  assert.equal(calls[0].url.searchParams.get('timeout'), '120');
  assert.equal(calls[0].url.searchParams.get('memory'), '256');
  for (const buildNumber of ['latest', '0.1', '0.1.2&timeout=0', '', null, 12]) {
    assert.throws(() => client.runActor('actor1', {}, { buildNumber }), { code: 'INVALID_BUILD' });
  }
  assert.equal(calls.length, 1);
});
test('Dataset at the exact item limit is accepted only after checking for another record', async () => {
  const rows = Array.from({ length: 3 }, (_, id) => ({ id }));
  const { client, calls } = stubClient((url) => {
    const query = new URL(url).searchParams;
    const offset = Number(query.get('offset'));
    const limit = Number(query.get('limit'));
    return new Response(JSON.stringify(rows.slice(offset, offset + limit)));
  }, { maxItems: 3 });
  assert.deepEqual(await client.getDatasetItems('dataset123'), rows);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('offset'), '3');
  assert.equal(calls[1].url.searchParams.get('limit'), '1');
});

test('Dataset with an extra record fails instead of returning a silently truncated result', async () => {
  const rows = Array.from({ length: 4 }, (_, id) => ({ id }));
  const { client, calls } = stubClient((url) => {
    const query = new URL(url).searchParams;
    const offset = Number(query.get('offset'));
    const limit = Number(query.get('limit'));
    return new Response(JSON.stringify(rows.slice(offset, offset + limit)));
  }, { maxItems: 3 });
  await assert.rejects(client.getDatasetItems('dataset123'), { code: 'DATASET_LIMIT' });
  assert.equal(calls.length, 2);
});

test('Dataset completeness probe rejects a malformed response', async () => {
  const { client } = stubClient((_url, _init, call) => new Response(JSON.stringify(call === 1 ? [{ id: 1 }] : { invalid: true })), { maxItems: 1 });
  await assert.rejects(client.getDatasetItems('dataset123'), { code: 'INVALID_RESPONSE' });
});
test('Actor version retrieval preserves documented text files and directory entries', async () => {
  const version = {
    versionNumber: '0.1', sourceType: 'SOURCE_FILES',
    sourceFiles: [
      { name: 'src/main.mjs', format: 'TEXT', content: 'export const main = true;' },
      { name: 'src', folder: true },
    ],
  };
  const { client, calls } = stubClient(() => response(version));
  assert.deepEqual(await client.getActorVersion('owner~actor-name', '0.1'), version);
  assert.equal(calls[0].url.pathname, '/v2/actors/owner~actor-name/versions/0.1');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
  for (const versionNumber of ['latest', '1', '0.1.2', '100.1', '01.1', '../0.1', '0.1?token=x', null, 1]) {
    assert.throws(() => client.getActorVersion('actor1', versionNumber), { code: 'INVALID_VERSION' });
  }
  assert.equal(calls.length, 1);
});
test('missing public profile has actionable guidance without exposing server text', async () => {
  const { client, calls } = stubClient(() => new Response(JSON.stringify({ error: { type: 'username-required', message: 'Private details ' + token } }), { status: 403 }));
  await assert.rejects(client.publishActor('actor123'), (error) => {
    assert.equal(error.code, 'APIFY_HTTP');
    assert.equal(error.status, 403);
    assert.equal(error.reason, 'username-required');
    assert.equal(error.outcomeUnknown, false);
    assert.match(error.message, /Settings > Account > Profile/);
    assert.ok(!error.message.includes(token));
    assert.ok(!error.message.includes('Private details'));
    return true;
  });
  assert.equal(calls.length, 1);
});

test('first-publication terms require owner action and keep raw error details private', async () => {
  const { client } = stubClient(() => new Response(JSON.stringify({ error: { type: 'store-terms-not-accepted', message: token } }), { status: 403 }));
  await assert.rejects(client.publishActor('actor123'), (error) => {
    assert.equal(error.reason, 'store-terms-not-accepted');
    assert.match(error.message, /account owner must review and accept/);
    assert.ok(!error.message.includes(token));
    return true;
  });
});
