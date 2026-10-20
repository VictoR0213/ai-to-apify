import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function cleanEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(APIFY_TOKEN|QF_.*|NODE_OPTIONS|NODE_TEST_CONTEXT)$/i.test(key)));
}

export async function checkDemo(root) {
  const parent = path.resolve(tmpdir());
  const scratch = await mkdtemp(path.join(parent, 'quotaforge-preview-demo-'));
  try {
    // The CLI loads .env from cwd. A fresh cwd prevents a developer's credentials or state from leaking in.
    const output = execFileSync(process.execPath, [path.join(root, 'src/cli.mjs'), 'demo'], {
      cwd: scratch, env: cleanEnvironment(), encoding: 'utf8', windowsHide: true, timeout: 60000,
    });
    const demo = JSON.parse(output);
    assert.equal(demo.status, 'tested');
    assert.equal(demo.tests.passed, true);
    assert.ok(demo.tests.results.length > 0);
    assert.ok(demo.tests.results.every((fixture) => fixture.passed));
    assert.equal(path.resolve(demo.artifactDirectory), path.join(scratch, '.quotaforge', 'artifacts', demo.id));
    const state = JSON.parse(await readFile(path.join(scratch, '.quotaforge/state.json'), 'utf8'));
    assert.equal(state.projects.length, 1);
    assert.equal(state.projects[0].generation.deterministic, true);
    assert.equal(state.projects[0].deployment, null);
    assert.deepEqual(state.ledger, []);
    execFileSync(process.execPath, ['--test', path.join(demo.artifactDirectory, 'test/tool.test.mjs')], {
      cwd: scratch, env: cleanEnvironment(), stdio: 'inherit', windowsHide: true, timeout: 60000,
    });
    console.log(`Clean local demo passed: ${demo.tests.results.length} independent fixtures, generated Actor tests, no deployment, empty ledger.`);
  } finally {
    assert.equal(path.dirname(path.resolve(scratch)), parent);
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkDemo(fileURLToPath(new URL('../', import.meta.url)));
}
