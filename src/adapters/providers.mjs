import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const OUTPUT_LIMIT = 2 * 1024 * 1024;
const PROVIDERS = ['claude', 'codex'];

function failure(message, code) {
  return Object.assign(new Error(message), { code });
}

function executable(provider) {
  if (!PROVIDERS.includes(provider)) throw failure('Unsupported provider.', 'INVALID_PROVIDER');
  const bin = process.env[`QF_${provider.toUpperCase()}_BIN`] || `${provider}${process.platform === 'win32' ? '.exe' : ''}`;
  if (/[\r\n\0]/.test(bin) || /\.(cmd|bat|ps1)$/i.test(bin)) {
    throw failure('Use a native executable, not a shell wrapper. On Windows, configure the CLI .exe path.', 'UNSUPPORTED_EXECUTABLE');
  }
  if (process.platform === 'win32' && extname(bin).toLowerCase() !== '.exe') {
    throw failure('Windows provider paths must point to a native .exe file.', 'UNSUPPORTED_EXECUTABLE');
  }
  return bin;
}

function childEnvironment(provider) {
  // Only OS configuration and the selected official provider's authentication are inherited.
  const names = new Set([
    'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'USERPROFILE',
    'HOME', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP',
    'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'COLORTERM', 'NO_COLOR',
    'SHELL', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'COMMONPROGRAMFILES',
    'NUMBER_OF_PROCESSORS', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR',
  ]);
  if (provider === 'claude') {
    names.add('ANTHROPIC_API_KEY');
    names.add('CLAUDE_CODE_OAUTH_TOKEN');
  } else if (provider === 'codex') {
    names.add('OPENAI_API_KEY');
    names.add('CODEX_API_KEY');
  }
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => names.has(name.toUpperCase())));
}

async function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        shell: false, windowsHide: true, stdio: 'ignore',
      });
      const timer = setTimeout(() => { killer.kill(); resolve(); }, 2500);
      const done = () => { clearTimeout(timer); resolve(); };
      killer.once('error', done);
      killer.once('close', done);
    });
    try { child.kill('SIGKILL'); } catch { /* Process may already have exited. */ }
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch { try { child.kill('SIGKILL'); } catch { /* Already exited. */ } }
  }
}

/** Run a native executable without shell interpolation. Raw stderr is never exposed. */
export function runProcess(bin, args, { input = '', cwd, timeoutMs = 180000, signal, maxOutputBytes = OUTPUT_LIMIT, provider } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900000) {
    return Promise.reject(failure('Timeout must be between 1 and 900000 milliseconds.', 'INVALID_TIMEOUT'));
  }
  if (signal?.aborted) return Promise.reject(failure('Operation cancelled.', 'ABORTED'));
  return new Promise((resolve, reject) => {
    let child;
    let finished = false;
    let terminalError;
    let stdout = '';
    let bytes = 0;
    let timer;
    let fallback;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    };
    const stop = (error) => {
      if (terminalError || finished) return;
      terminalError = error;
      void killTree(child).then(() => finish(error));
      fallback = setTimeout(() => finish(error), 3500);
    };
    const abort = () => stop(failure('Operation cancelled.', 'ABORTED'));
    try {
      child = spawn(bin, args, {
        cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32',
        env: childEnvironment(provider), stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      finish(failure('Could not start the provider executable.', 'SPAWN_FAILED'));
      return;
    }
    timer = setTimeout(() => stop(failure('Provider timed out. No result was accepted.', 'TIMEOUT')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxOutputBytes) stop(failure('Provider output exceeded the size limit.', 'OUTPUT_LIMIT'));
      else stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) stop(failure('Provider output exceeded the size limit.', 'OUTPUT_LIMIT'));
    });
    child.on('error', () => finish(terminalError || failure('Provider executable was not found or could not be started.', 'SPAWN_FAILED')));
    child.on('close', (code) => {
      if (terminalError) finish(terminalError);
      else if (code !== 0) finish(failure(`Provider exited unsuccessfully (${code ?? 'signal'}). Check CLI installation and login locally. Raw logs are withheld to protect credentials.`, 'PROVIDER_FAILED'));
      else finish(null, { stdout, exitCode: code });
    });
    child.stdin.on('error', () => { /* Closing stdin early is reflected by the process result. */ });
    child.stdin.end(input);
  });
}

export async function detectProviders() {
  return Promise.all(PROVIDERS.map(async (id) => {
    try {
      const { stdout } = await runProcess(executable(id), ['--version'], { timeoutMs: 5000, maxOutputBytes: 8192 });
      const version = stdout.match(/\b\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?\b/)?.[0];
      return { id, available: true, ...(version ? { version } : {}) };
    } catch (error) {
      return { id, available: false, error: error.message };
    }
  }));
}

function parseObject(text) {
  let value;
  try { value = JSON.parse(text); }
  catch { throw failure('Provider returned invalid JSON.', 'INVALID_JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw failure('Provider must return a JSON object.', 'INVALID_JSON');
  }
  return value;
}

export function parseProviderOutput(provider, text) {
  const value = parseObject(text);
  if (provider === 'codex') return value;
  if (provider !== 'claude') throw failure('Unsupported provider.', 'INVALID_PROVIDER');
  if (value.is_error || (value.subtype && value.subtype !== 'success')) {
    throw failure('Claude did not complete the structured generation successfully.', 'PROVIDER_FAILED');
  }
  if (value.structured_output && typeof value.structured_output === 'object' && !Array.isArray(value.structured_output)) {
    return value.structured_output;
  }
  if (typeof value.result === 'string') return parseObject(value.result);
  throw failure('Claude returned no structured JSON result.', 'INVALID_JSON');
}

export function buildProviderArgs(provider, { schemaPath, outputPath, schemaText, maxBudgetUsd } = {}) {
  if (!PROVIDERS.includes(provider)) throw failure('Unsupported provider.', 'INVALID_PROVIDER');
  const args = provider === 'codex'
    ? ['exec', '--ignore-user-config', '--json', '--ephemeral', '--output-schema', schemaPath, '--output-last-message', outputPath, '--skip-git-repo-check', '-s', 'read-only', '-']
    : ['-p', '--safe-mode', '--output-format', 'json', '--json-schema', schemaText, '--tools', '', '--disallowedTools', 'mcp__*', '--no-session-persistence'];
  if (provider === 'codex') {
    // Structured generation needs no local files, connectors, or delegated tool access.
    for (const feature of ['shell_tool', 'unified_exec', 'view_image', 'apps', 'plugins', 'multi_agent', 'browser_use', 'computer_use', 'hooks', 'code_mode_host', 'workspace_dependencies']) args.push('--disable', feature);
    args.push('-c', 'web_search="disabled"');
  }
  if (provider === 'claude' && maxBudgetUsd !== undefined) args.push('--max-budget-usd', String(maxBudgetUsd));
  return args;
}
/** The caller must validate the resulting specification against its domain schema. */
export async function generateSpec({ provider, prompt, schema, cwd, timeoutMs = 180000, maxBudgetUsd, signal } = {}) {
  const bin = executable(provider);
  if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) > 256 * 1024) {
    throw failure('Prompt must be nonempty and at most 256 KiB.', 'INVALID_PROMPT');
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw failure('A JSON schema object is required.', 'INVALID_SCHEMA');
  if (maxBudgetUsd !== undefined && (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0)) {
    throw failure('Budget must be a positive number.', 'INVALID_BUDGET');
  }
  if (provider === 'codex' && maxBudgetUsd !== undefined) {
    throw failure('Codex CLI does not enforce a per-run dollar budget. Omit maxBudgetUsd or choose Claude.', 'UNSUPPORTED_BUDGET');
  }
  const schemaText = JSON.stringify(schema);
  if (Buffer.byteLength(schemaText) > 128 * 1024) throw failure('JSON schema is too large.', 'INVALID_SCHEMA');
  const started = Date.now();
  const temp = await mkdtemp(join(tmpdir(), 'quota-forge-provider-'));
  try {
    const schemaPath = join(temp, 'schema.json');
    const outputPath = join(temp, 'result.json');
    await writeFile(schemaPath, schemaText, { mode: 0o600 });
    const args = buildProviderArgs(provider, { schemaPath, outputPath, schemaText, maxBudgetUsd });
    const { stdout } = await runProcess(bin, args, {
      input: `${prompt}\n\nReturn only the JSON object matching the supplied schema. Do not access files, execute commands, browse, or use credentials.\n`,
      cwd: cwd || temp, timeoutMs, signal, provider,
    });
    let text = stdout;
    if (provider === 'codex') {
      const info = await stat(outputPath).catch(() => null);
      if (!info?.isFile()) throw failure('Codex returned no final output file.', 'INVALID_JSON');
      if (info.size > OUTPUT_LIMIT) throw failure('Provider result exceeded the size limit.', 'OUTPUT_LIMIT');
      text = await readFile(outputPath, 'utf8');
    }
    const spec = parseProviderOutput(provider, text);
    return { spec, metadata: { provider, durationMs: Date.now() - started, budgetEnforced: provider === 'claude' && maxBudgetUsd !== undefined } };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
