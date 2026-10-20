import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview, verifyPreview, extractPreview } from './source-archive.mjs';
import { checkDemo, cleanEnvironment } from './check-demo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [command = 'help', ...args] = process.argv.slice(2);
const usage = 'Usage: node scripts/preview.mjs pack [--out directory] | verify <archive.zip> | check';

try {
  if (command === 'pack') {
    if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error(usage);
    const preview = await buildPreview(root);
    verifyPreview(preview.archive);
    const directory = path.resolve(args[1] || path.join(root, 'release'));
    await mkdir(directory, { recursive: true });
    const archivePath = path.join(directory, preview.filename);
    const checksumPath = archivePath + '.sha256';
    const outputs = [[archivePath, preview.archive], [checksumPath, Buffer.from(`${preview.checksum}  ${preview.filename}\n`)]];
    for (const [target, content] of outputs) {
      try { assert.ok((await readFile(target)).equals(content), 'Output exists with different content; choose a fresh --out directory: ' + target); }
      catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(target, content, { flag: 'wx' }); }
    }
    console.log(JSON.stringify({ archive: archivePath, checksumFile: checksumPath, sha256: preview.checksum, sourceFiles: preview.manifest.files.length }, null, 2));
  } else if (command === 'verify') {
    if (args.length !== 1) throw new Error(usage);
    const archivePath = path.resolve(args[0]);
    const checked = verifyPreview(await readFile(archivePath));
    assert.equal(await readFile(archivePath + '.sha256', 'utf8'), `${checked.checksum}  ${path.basename(archivePath)}\n`, 'Archive SHA-256 sidecar does not match.');
    console.log(`Verified ${checked.manifest.files.length} allowlisted source files and SHA-256: ${checked.checksum}`);
  } else if (command === 'check') {
    if (args.length) throw new Error(usage);
    const first = await buildPreview(root), second = await buildPreview(root);
    assert.ok(first.archive.equals(second.archive), 'Repeated preview builds must be byte-identical.');
    const damaged = Buffer.from(first.archive);
    damaged[30 + damaged.readUInt16LE(26)] ^= 1;
    assert.throws(() => verifyPreview(damaged), /corrupt|hashes/, 'Changed ZIP contents must fail verification.');
    const parent = path.resolve(tmpdir());
    const scratch = await mkdtemp(path.join(parent, 'quotaforge-preview-check-'));
    try {
      const extracted = await extractPreview(first.archive, scratch);
      const privatePaths = ['.env', '.quotaforge/state.json', 'exports/private.json', 'docs/private-input.json', 'private.log'];
      for (const name of privatePaths) {
        const target = path.join(extracted, name);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, 'private-exclusion-check\n', { flag: 'wx' });
      }
      const readme = path.join(extracted, 'README.md');
      const original = await readFile(readme, 'utf8');
      await writeFile(readme, original.replace(/\n/g, '\r\n'));
      assert.ok(first.archive.equals((await buildPreview(extracted)).archive), 'CRLF checkouts and unlisted private files must not change the public preview.');
      await writeFile(readme, original);
      for (const name of privatePaths) await rm(path.join(extracted, name));
      execFileSync(process.execPath, ['--run', 'test'], { cwd: extracted, env: cleanEnvironment(), stdio: 'inherit', windowsHide: true, timeout: 120000 });
      await checkDemo(extracted);
      console.log(`Source preview passed: reproducible ZIP, ${first.manifest.files.length} allowlisted files, verified manifest, extracted-source tests and clean demo.`);
      console.log(`SHA-256: ${first.checksum}`);
    } finally {
      assert.equal(path.dirname(path.resolve(scratch)), parent);
      await rm(scratch, { recursive: true, force: true });
    }
  } else if (command === 'help') console.log(usage);
  else throw new Error(usage);
} catch (error) {
  console.error('Preview check failed: ' + error.message);
  process.exitCode = 1;
}
