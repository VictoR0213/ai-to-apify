import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { demoSpec, example } from '../src/spec.mjs';
import { transformRecords, validateSpec, toCSV } from '../src/runtime.mjs';
import { QuotaForge } from '../src/service.mjs';
import { Store } from '../src/store.mjs';
import { summarize, validateEntry, importRunCosts } from '../src/ledger.mjs';
import { saveArtifact } from '../src/artifact.mjs';

async function setup(t, extra = {}) {
  const parent = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(parent, 'quotaforge-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), parent);
    await rm(directory, { recursive: true, force: true });
  });
  let buildStatus = 'SUCCEEDED';
  const calls = [];
  const apify = {
    async createActor(payload) { calls.push(['create', payload]); return { id: 'actor123' }; },
    async getActorVersion() { return { sourceType: 'SOURCE_FILES', sourceFiles: calls.find(([name]) => name === 'create')[1].files.map((file) => ({ ...file, format: 'TEXT' })) }; },
    async buildActor(id) { calls.push(['build', id]); return { id: 'build123', status: 'READY' }; },
    async getBuild() { return { id: 'build123', status: buildStatus, actId: 'actor123', buildNumber: '0.1.1' }; },
    async getActor() { return { id: 'actor123', username: 'tester', name: 'catalog' }; },
    async publishActor(id, options) { calls.push(['publish', id, options]); return { id, isPublic: true }; },
    async runActor() { return { id: 'run123', status: 'SUCCEEDED', defaultDatasetId: 'data123', usageTotalUsd: 0.001 }; },
    async getDatasetItems() { return structuredClone(example.fixtures[0].expected); },
    async listRuns() { return [{ id: 'run123', status: 'SUCCEEDED', usageTotalUsd: 0.025, finishedAt: '2026-01-01T00:00:00Z' }]; },
  };
  const app = new QuotaForge({ dataDir: directory, detect: async () => [], apify, ...extra });
  return { app, directory, calls, apify, setBuildStatus: (value) => { buildStatus = value; } };
}
test('fixed fixtures define exact output, deduplication order and optional values', () => {
  for (const fixture of example.fixtures) assert.deepEqual(transformRecords(demoSpec(), fixture.input).records, fixture.expected);
});
test('required fields and malformed numbers fail before any output', () => {
  assert.throws(() => transformRecords(demoSpec(), { records: [{ title: ' ', category: 'x', url: 'x', price: 1 }] }), /required/);
  assert.throws(() => transformRecords(demoSpec(), { records: [{ title: 'X', category: 'x', url: 'x', price: 'NaN' }] }), /number/);
  assert.throws(() => transformRecords(demoSpec(), { records: [{ title: 'X', category: 'x', url: 'x', price: true }] }), /number/);
});
test('spec allowlist rejects code, prototype keys, duplicate targets and invalid sort keys', () => {
  assert.throws(() => validateSpec({ ...demoSpec(), code: 'process.exit()' }), /unsupported/);
  const proto = demoSpec(); proto.fields[0].target = '__proto__';
  assert.throws(() => validateSpec(proto), /safe/);
  const duplicate = demoSpec(); duplicate.fields[1].target = 'name';
  assert.throws(() => validateSpec(duplicate), /Duplicate/);
  assert.throws(() => validateSpec({ ...demoSpec(), sortBy: 'missing' }), /sortBy/);
});
test('inherited input fields are not accepted', () => {
  const row = Object.create({ title: 'Hidden' }); Object.assign(row, { category: 'x', url: 'x' });
  assert.throws(() => transformRecords(demoSpec(), { records: [row] }), /required/);
});
test('CSV export escapes quotes, newlines and spreadsheet formulas', () => {
  const csv = toCSV(demoSpec(), [{ name: '=1+1', category: 'a"b', url: 'line\nbreak', price: -2 }]);
  assert.ok(csv.includes("\"'=1+1\""));
  assert.ok(csv.includes('"a""b"'));
  assert.ok(csv.includes('"line\nbreak"'));
  assert.ok(csv.includes('"-2"'));
});
test('demo produces a tested source bundle and exactly zero earnings', async (t) => {
  const { app, calls } = await setup(t);
  const project = await app.demo();
  assert.equal(project.status, 'tested');
  assert.equal(project.generation.deterministic, true);
  assert.equal((await app.state()).summary.cashReceivedUsd, 0);
  assert.equal(calls.length, 0);
  const artifact = await app.artifact(project.id);
  assert.ok(artifact.files.some((file) => file.name === 'Dockerfile'));
  const directory = await saveArtifact(app.store.root, artifact);
  const output = execFileSync(process.execPath, ['--test', path.join(directory, 'test/tool.test.mjs')], { encoding: 'utf8', windowsHide: true, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')) });
  assert.match(output, /pass 3/);
});
test('model generation never receives expected fixture answers', async (t) => {
  let seenPrompt;
  let seenCwd;
  const { app } = await setup(t, { generate: async (options) => { seenPrompt = options.prompt; seenCwd = options.cwd; return { spec: demoSpec(example.name), metadata: { provider: 'codex' } }; } });
  const project = await app.create(example);
  await app.generate(project.id, 'codex');
  assert.ok(!seenPrompt.includes('"expected"'));
  assert.equal((await app.test(project.id)).verification.passed, true);
});
test('test failure blocks remote deployment', async (t) => {
  const { app, calls } = await setup(t);
  const spec = structuredClone(example); spec.fixtures[0].expected[0].name = 'Wrong';
  const project = await app.create(spec);
  await app.generate(project.id, 'demo');
  assert.equal((await app.test(project.id)).verification.passed, false);
  await assert.rejects(app.deploy(project.id, true), /tests must pass/);
  assert.equal(calls.length, 0);
});
test('changed artifacts cannot reuse a passing test receipt', async (t) => {
  const { app, calls } = await setup(t);
  const project = await app.demo();
  await app.store.update((state) => { state.projects[0].spec.description = 'Changed after testing'; });
  await assert.rejects(app.deploy(project.id, true), /changed after testing/);
  assert.equal(calls.length, 0);
});
test('fixed fixtures cannot be silently rewritten after generation', async (t) => {
  const { app } = await setup(t);
  const project = await app.demo();
  await app.store.update((state) => { state.projects[0].fixtures[0].expected = []; });
  await assert.rejects(app.test(project.id), /fixtures changed/);
});
test('private deployment and successful cloud build gate public publication', async (t) => {
  const { app, calls, setBuildStatus } = await setup(t);
  const project = await app.demo();
  await assert.rejects(app.deploy(project.id, false), /confirmation/);
  await app.deploy(project.id, true);
  assert.equal((await app.project(project.id)).deployment.isPublic, false);
  setBuildStatus('FAILED');
  await assert.rejects(app.publish(project.id, true), /must succeed/);
  assert.equal(calls.filter(([name]) => name === 'publish').length, 0);
  setBuildStatus('SUCCEEDED');
  await assert.rejects(app.publish(project.id, true), /cloud check/);
  assert.equal((await app.smoke(project.id, true)).smoke.passed, true);
  const published = await app.publish(project.id, true);
  assert.equal(published.status, 'published');
  assert.equal(calls.find(([name]) => name === 'publish')[2].buildNumber, '0.1.1');
  assert.match(published.deployment.monetization, /public does not mean paid/);
});
test('failed build request preserves actor identity for retry', async (t) => {
  const { app, calls, apify } = await setup(t);
  const project = await app.demo();
  apify.buildActor = async () => { throw new Error('Build request rejected'); };
  await assert.rejects(app.deploy(project.id, true), /rejected/);
  assert.equal((await app.project(project.id)).deployment.actorId, 'actor123');
  apify.buildActor = async () => ({ id: 'build234', status: 'READY' });
  await app.deploy(project.id, true);
  assert.equal(calls.filter(([name]) => name === 'create').length, 1);
});
test('concurrent store mutations do not lose data', async (t) => {
  const { directory } = await setup(t);
  const storeA = new Store(directory), storeB = new Store(directory);
  await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? storeA : storeB).update((state) => state.ledger.push({ index }))));
  assert.equal((await storeA.read()).ledger.length, 12);
});
test('generation failure is recoverable and does not leave a busy project', async (t) => {
  const { app } = await setup(t, { generate: async () => { throw new Error('Provider unavailable'); } });
  const project = await app.create(example);
  await assert.rejects(app.generate(project.id, 'codex'), /unavailable/);
  assert.equal((await app.project(project.id)).operation, null);
  await app.generate(project.id, 'demo');
  assert.equal((await app.test(project.id)).verification.passed, true);
});
test('net cash excludes pending earnings and informational platform usage', () => {
  const ledger = [
    { projectId: 'a', kind: 'pending', amountUsd: 100, reference: 'statement' },
    { projectId: 'a', kind: 'payout', amountUsd: 80, reference: 'receipt', settlesReference: 'statement' },
    { projectId: 'a', kind: 'expense', amountUsd: 5 },
    { projectId: 'a', kind: 'run-cost', amountUsd: 20 },
  ];
  const result = summarize(ledger);
  assert.equal(result.cashReceivedUsd, 80);
  assert.equal(result.pendingUsd, 0);
  assert.equal(result.costsUsd, 5);
  assert.equal(result.platformUsageUsd, 20);
  assert.equal(result.netCashUsd, 75);
});
test('manual ledger rejects duplicate evidence, missing projects and invalid money', () => {
  const projects = [{ id: 'a' }];
  const entry = { projectId: 'a', kind: 'payout', amountUsd: 10, reference: 'receipt', occurredAt: '2026-01-01' };
  const validated = validateEntry(entry, projects, []);
  assert.equal(validated.verification, 'self-reported');
  assert.throws(() => validateEntry(entry, projects, [validated]), /already/);
  assert.throws(() => validateEntry({ ...entry, amountUsd: -1 }, projects, []), /positive/);
  assert.throws(() => validateEntry({ ...entry, projectId: 'b' }, projects, []), /existing/);
  assert.throws(() => validateEntry({ ...entry, occurredAt: '2026-02-31' }, projects, []), /valid date/);
});
for (const scenario of [
  { timezone: 'Asia/Singapore', instant: '2026-10-20T17:00:00.000Z', today: '2026-10-21', tomorrow: '2026-10-22' },
  { timezone: 'America/Los_Angeles', instant: '2026-10-21T03:00:00.000Z', today: '2026-10-20', tomorrow: '2026-10-21' },
]) test(`manual ledger uses the local calendar date across midnight in ${scenario.timezone}`, () => {
  // Isolate the frozen clock and timezone from the other test workers.
  const script = `
    import assert from 'node:assert/strict';
    import { validateEntry } from ${JSON.stringify(new URL('../src/ledger.mjs', import.meta.url).href)};
    const { instant, today, tomorrow } = ${JSON.stringify(scenario)};
    globalThis.Date = class extends Date {
      constructor(...args) { super(...(args.length ? args : [instant])); }
    };
    const projects = [{ id: 'local-date-test' }];
    const entry = { projectId: projects[0].id, kind: 'payout', amountUsd: 1, reference: 'synthetic', occurredAt: today };
    assert.equal(validateEntry(entry, projects, []).occurredAt, today);
    assert.throws(() => validateEntry({ ...entry, occurredAt: tomorrow }, projects, []), /future/);
    assert.throws(() => validateEntry({ ...entry, occurredAt: '2026-02-31' }, projects, []), /valid date/);
    assert.throws(() => validateEntry({ ...entry, occurredAt: '2025-02-29' }, projects, []), /valid date/);
    assert.equal(validateEntry({ ...entry, occurredAt: '2024-02-29' }, projects, []).occurredAt, '2024-02-29');
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', windowsHide: true,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')), TZ: scenario.timezone },
  });
});
test('run-cost sync is idempotent, bounded to final runs, and never fabricates income', () => {
  const state = { ledger: [] };
  const runs = [
    { id: 'one', status: 'RUNNING', usageTotalUsd: 5 },
    { id: 'two', status: 'SUCCEEDED', usageTotalUsd: 0.12, finishedAt: '2026-01-01' },
  ];
  assert.equal(importRunCosts(state, 'a', runs), 1);
  assert.equal(importRunCosts(state, 'a', runs), 0);
  assert.equal(state.ledger[0].kind, 'run-cost');
  assert.equal(summarize(state.ledger).cashReceivedUsd, 0);
  assert.equal(summarize(state.ledger).netCashUsd, 0);
});

test('failed cloud builds can be rebuilt without creating another Actor', async (t) => {
  const { app, calls, setBuildStatus } = await setup(t);
  const project = await app.demo();
  await app.deploy(project.id, true);
  setBuildStatus('FAILED');
  await app.deploy(project.id, true);
  assert.equal(calls.filter(([name]) => name === 'create').length, 1);
  assert.equal(calls.filter(([name]) => name === 'build').length, 2);
});
test('a mismatched cloud dataset blocks publication', async (t) => {
  const { app, apify, calls } = await setup(t);
  const project = await app.demo();
  await app.deploy(project.id, true);
  apify.getDatasetItems = async () => [{ unrelated: true }];
  const checked = await app.smoke(project.id, true);
  assert.equal(checked.smoke.passed, false);
  await assert.rejects(app.publish(project.id, true), /cloud check/);
  assert.equal(calls.filter(([name]) => name === 'publish').length, 0);
});
test('cloud check requires explicit confirmation before creating a run', async (t) => {
  const { app } = await setup(t);
  const project = await app.demo();
  await app.deploy(project.id, true);
  await assert.rejects(app.smoke(project.id, false), /confirmation/);
  assert.equal((await app.project(project.id)).smoke, undefined);
});
test('public publication rejects a build belonging to another Actor', async (t) => {
  const { app, apify, calls } = await setup(t);
  const project = await app.demo();
  await app.deploy(project.id, true);
  await app.smoke(project.id, true);
  apify.getBuild = async () => ({ id: 'build123', status: 'SUCCEEDED', actId: 'otherActor', buildNumber: '0.1.1' });
  await assert.rejects(app.publish(project.id, true), /does not belong/);
  assert.equal(calls.filter(([name]) => name === 'publish').length, 0);
});
test('settling a pending statement does not double-count receipts or allow repeated settlement', async (t) => {
  const { app } = await setup(t);
  const project = await app.demo();
  const base = { projectId: project.id, occurredAt: '2026-01-01' };
  await app.addEntry({ ...base, kind: 'pending', amountUsd: 100, reference: 'invoice-1' });
  await app.addEntry({ ...base, kind: 'payout', amountUsd: 80, reference: 'receipt-1', settlesReference: 'invoice-1' });
  const state = await app.state();
  assert.equal(state.summary.cashReceivedUsd, 80);
  assert.equal(state.summary.pendingUsd, 0);
  await assert.rejects(app.addEntry({ ...base, kind: 'payout', amountUsd: 80, reference: 'receipt-2', settlesReference: 'invoice-1' }), /already been settled/);
});

test('rebuild rejects remote source edits before requesting another build', async (t) => {
  const { app, apify, calls, setBuildStatus } = await setup(t);
  const project = await app.demo();
  await app.deploy(project.id, true);
  setBuildStatus('FAILED');
  const original = await apify.getActorVersion();
  original.sourceFiles.find((file) => file.name === 'src/main.mjs').content += '\nconsole.log("changed");';
  apify.getActorVersion = async () => original;
  await assert.rejects(app.deploy(project.id, true), /differs from the tested artifact/);
  assert.equal(calls.filter(([name]) => name === 'build').length, 1);
});

test('remote source comparison tolerates directory entries but rejects duplicate files', async (t) => {
  const { app, apify } = await setup(t);
  const project = await app.demo();
  const artifact = await app.artifact(project.id);
  const files = artifact.files.map((file) => ({ ...file, format: 'TEXT' }));
  apify.getActorVersion = async () => ({ sourceType: 'SOURCE_FILES', sourceFiles: [{ name: 'src', folder: true }, ...files] });
  await app.verifiedRemoteSource('actor123', artifact);
  apify.getActorVersion = async () => ({ sourceType: 'SOURCE_FILES', sourceFiles: [...files, files[0]] });
  await assert.rejects(app.verifiedRemoteSource('actor123', artifact), /differs/);
});

test('Actor output metadata covers delivered fields and links the default dataset', async (t) => {
  const { app } = await setup(t);
  const project = await app.demo();
  const artifact = await app.artifact(project.id);
  const get = (name) => JSON.parse(artifact.files.find((file) => file.name === name).content);
  const definition = get('.actor/actor.json');
  assert.equal(definition.output, './output_schema.json');
  assert.equal(definition.storages.dataset, './dataset_schema.json');
  const output = get('.actor/output_schema.json');
  assert.equal(output.actorOutputSchemaVersion, 1);
  assert.equal(output.properties.results.template, '{{links.apiDefaultDatasetUrl}}/items');
  const dataset = get('.actor/dataset_schema.json');
  assert.deepEqual(dataset.views.overview.transformation.fields, ['name', 'category', 'url', 'price']);
  for (const fixture of example.fixtures) for (const record of fixture.expected) {
    for (const key of dataset.fields.required) assert.ok(Object.hasOwn(record, key));
    for (const [key, value] of Object.entries(record)) {
      const allowed = [dataset.fields.properties[key].type].flat();
      assert.ok(allowed.includes(value === null ? 'null' : typeof value), key);
    }
  }
});
