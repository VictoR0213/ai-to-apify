const API_BASE = 'https://api.apify.com/v2/';
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

function failure(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_~-]{1,200}$/.test(value)) {
    throw failure('Invalid Apify resource identifier.', 'INVALID_ID');
  }
  return encodeURIComponent(value);
}

function normalizeFiles(files) {
  const entries = Array.isArray(files) ? files : (files && typeof files === 'object'
    ? Object.entries(files).map(([name, content]) => ({ name, content })) : []);
  if (!entries.length || entries.length > 100) throw failure('Actor must contain between 1 and 100 source files.', 'INVALID_FILES');
  let size = 0;
  const names = new Set();
  return entries.map((file) => {
    const { name, content } = file || {};
    if (typeof name !== 'string' || name.length > 240 || /[\\\r\n\0:]/.test(name) || name.startsWith('/')
      || name.split('/').some((part) => !part || part === '.' || part === '..') || names.has(name)) {
      throw failure('Actor source filenames must be unique, safe relative paths.', 'INVALID_FILES');
    }
    if (typeof content !== 'string') throw failure('Actor source file content must be text.', 'INVALID_FILES');
    names.add(name);
    size += Buffer.byteLength(content);
    if (size > MAX_SOURCE_BYTES) throw failure('Actor source exceeds the 5 MiB upload limit.', 'INVALID_FILES');
    return { name, format: 'TEXT', content };
  });
}

async function readLimited(response, signal) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw failure('Apify response exceeded the size limit.', 'RESPONSE_LIMIT');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw failure('Apify request was cancelled or timed out.', 'ABORTED');
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw failure('Apify response exceeded the size limit.', 'RESPONSE_LIMIT');
      }
      chunks.push(value);
    }
    if (signal.aborted) throw failure('Apify request was cancelled or timed out.', 'ABORTED');
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

/** Direct Apify client. Publishing makes an Actor public; it does not enable billing. */
export class ApifyClient {
  #token;
  #fetch;
  #timeoutMs;
  #maxItems;

  constructor({ token = process.env.APIFY_TOKEN, fetchImpl = globalThis.fetch, timeoutMs = 30000, maxItems = 1000 } = {}) {
    if (typeof token !== 'string' || !token.trim() || /[\r\n\0]/.test(token)) {
      throw failure('Set APIFY_TOKEN before using Apify.', 'MISSING_TOKEN');
    }
    if (typeof fetchImpl !== 'function') throw failure('A fetch implementation is required.', 'INVALID_FETCH');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw failure('Invalid Apify request timeout.', 'INVALID_TIMEOUT');
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 10000) throw failure('maxItems must be between 1 and 10000.', 'INVALID_LIMIT');
    this.#token = token;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
    this.#maxItems = maxItems;
  }

  async #request(path, { method = 'GET', body, signal, unwrap = true } = {}) {
    if (signal?.aborted) throw failure('Apify request cancelled.', 'ABORTED');
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.#timeoutMs);
    const mutation = method !== 'GET';
    try {
      const response = await this.#fetch(new URL(path, API_BASE), {
        method, redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${this.#token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // Do not include server error bodies, URLs, source code, or credentials in diagnostics.
      if (!response.ok) {
        const knownReasons = {
          'username-required': 'Apify requires a public profile before publication. Set your public username/profile in Apify Console: Settings > Account > Profile, enable Make profile publicly visible, and save before retrying.',
          'store-terms-not-accepted': 'The account owner must review and accept the Apify Store publishing terms in the Actor Publishing tab before publication. Complete that step in Apify Console, then retry.',
        };
        let reason;
        try {
          const errorBody = JSON.parse(await readLimited(response, controller.signal));
          if (Object.hasOwn(knownReasons, errorBody?.error?.type)) reason = errorBody.error.type;
        } catch { /* Unknown error bodies stay private; use the generic diagnostic. */ }
        const message = reason ? knownReasons[reason] : `Apify returned HTTP ${response.status}. Check the account and request in Apify Console.`;
        throw failure(message, 'APIFY_HTTP', { status: response.status, outcomeUnknown: mutation && response.status >= 500, ...(reason ? { reason } : {}) });
      }
      const text = await readLimited(response, controller.signal);
      let json;
      try { json = JSON.parse(text); }
      catch { throw failure('Apify returned an invalid JSON response.', 'INVALID_RESPONSE', { outcomeUnknown: mutation }); }
      if (unwrap) {
        if (!json || typeof json !== 'object' || !Object.hasOwn(json, 'data')) throw failure('Apify response is missing data.', 'INVALID_RESPONSE', { outcomeUnknown: mutation });
        return json.data;
      }
      return json;
    } catch (error) {
      if (timedOut || signal?.aborted || controller.signal.aborted) {
        throw failure(timedOut ? 'Apify request timed out. Check Console before retrying a write.' : 'Apify request cancelled. Check Console before retrying a write.', timedOut ? 'TIMEOUT' : 'ABORTED', { outcomeUnknown: mutation });
      }
      if (['APIFY_HTTP', 'INVALID_RESPONSE', 'RESPONSE_LIMIT'].includes(error.code)) throw error;
      throw failure('Apify request failed. Check connectivity and Console before retrying a write.', 'APIFY_NETWORK', { outcomeUnknown: mutation });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  createActor({ name, title, description, files } = {}, options = {}) {
    if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 100) throw failure('Actor name must use lowercase letters, numbers, and hyphens.', 'INVALID_NAME');
    if (typeof title !== 'string' || !title.trim() || title.length > 200) throw failure('Actor title is required and must be at most 200 characters.', 'INVALID_TITLE');
    if (typeof description !== 'string' || description.length > 10000) throw failure('Actor description must be at most 10000 characters.', 'INVALID_DESCRIPTION');
    return this.#request('actors', {
      method: 'POST', signal: options.signal,
      body: {
        name, title, description, isPublic: false, categories: ['DEVELOPER_TOOLS'], actorPermissionLevel: 'LIMITED_PERMISSIONS',
        versions: [{ versionNumber: '0.1', sourceType: 'SOURCE_FILES', buildTag: 'latest', sourceFiles: normalizeFiles(files) }],
        defaultRunOptions: { build: 'latest', timeoutSecs: 120, memoryMbytes: 256, restartOnError: false },
      },
    });
  }

  buildActor(actorId, options = {}) {
    return this.#request(`actors/${identifier(actorId)}/builds?version=0.1&tag=latest&waitForFinish=0`, { method: 'POST', signal: options.signal });
  }

  getBuild(buildId, options = {}) {
    return this.#request(`actor-builds/${identifier(buildId)}`, { signal: options.signal });
  }

  getActor(actorId, options = {}) {
    return this.#request(`actors/${identifier(actorId)}`, { signal: options.signal });
  }

  getActorVersion(actorId, versionNumber = '0.1', options = {}) {
    if (typeof versionNumber !== 'string' || !/^([0-9]|[1-9][0-9])\.([0-9]|[1-9][0-9])$/.test(versionNumber)) {
      throw failure('Actor version must contain major.minor numbers from 0 to 99.', 'INVALID_VERSION');
    }
    return this.#request(`actors/${identifier(actorId)}/versions/${versionNumber}`, { signal: options.signal });
  }
  publishActor(actorId, options = {}) {
    const { buildNumber } = options;
    if (buildNumber !== undefined && (typeof buildNumber !== 'string' || !/^\d+\.\d+\.\d+$/.test(buildNumber) || buildNumber.length > 40)) {
      throw failure('An immutable three-part build number is required.', 'INVALID_BUILD');
    }
    const body = { isPublic: true };
    if (buildNumber !== undefined) {
      body.defaultRunOptions = { build: buildNumber, timeoutSecs: 120, memoryMbytes: 256, restartOnError: false };
    }
    return this.#request(`actors/${identifier(actorId)}`, { method: 'PUT', body, signal: options.signal });
  }

  async listRuns(actorId, options = {}) {
    const id = identifier(actorId);
    const items = [];
    while (items.length < this.#maxItems) {
      const limit = Math.min(100, this.#maxItems - items.length);
      const page = await this.#request(`actors/${id}/runs?offset=${items.length}&limit=${limit}&desc=1`, { signal: options.signal });
      if (!page || !Array.isArray(page.items) || page.items.length > limit) throw failure('Apify returned invalid run pagination.', 'INVALID_RESPONSE');
      items.push(...page.items);
      if (page.items.length < limit || (Number.isFinite(page.total) && items.length >= page.total)) break;
    }
    return items;
  }

  runActor(actorId, input, options = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure('Actor input must be a JSON object.', 'INVALID_INPUT');
    if (Buffer.byteLength(JSON.stringify(input)) > 1024 * 1024) throw failure('Actor input exceeds 1 MiB.', 'INVALID_INPUT');
    const { buildNumber } = options;
    if (buildNumber !== undefined && (typeof buildNumber !== 'string' || !/^\d+\.\d+\.\d+$/.test(buildNumber) || buildNumber.length > 40)) {
      throw failure('An immutable three-part build number is required.', 'INVALID_BUILD');
    }
    const build = buildNumber === undefined ? 'latest' : buildNumber;
    return this.#request(`actors/${identifier(actorId)}/runs?build=${build}&timeout=120&memory=256&waitForFinish=0`, { method: 'POST', body: input, signal: options.signal });
  }

  getRun(runId, options = {}) {
    return this.#request(`actor-runs/${identifier(runId)}`, { signal: options.signal });
  }

  async getDatasetItems(datasetId, options = {}) {
    const id = identifier(datasetId);
    const items = [];
    while (items.length < this.#maxItems) {
      const limit = Math.min(100, this.#maxItems - items.length);
      const page = await this.#request(`datasets/${id}/items?format=json&clean=true&offset=${items.length}&limit=${limit}`, { signal: options.signal, unwrap: false });
      if (!Array.isArray(page) || page.length > limit) throw failure('Apify returned invalid dataset pagination.', 'INVALID_RESPONSE');
      items.push(...page);
      if (page.length < limit) break;
    }
    if (items.length === this.#maxItems) {
      const extra = await this.#request(`datasets/${id}/items?format=json&clean=true&offset=${items.length}&limit=1`, { signal: options.signal, unwrap: false });
      if (!Array.isArray(extra) || extra.length > 1) throw failure('Apify returned invalid dataset pagination.', 'INVALID_RESPONSE');
      if (extra.length) throw failure('Dataset exceeds the configured item limit; completeness cannot be verified.', 'DATASET_LIMIT');
    }
    return items;
  }
}
