import { createHash } from 'node:crypto';
import { lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Each public source file is reviewed explicitly. Never recursively copy the checkout.
export const SOURCE_FILES = [
  '.env.example', '.gitattributes', '.gitignore', '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/config.yml', '.github/PULL_REQUEST_TEMPLATE.md', '.github/workflows/ci.yml',
  'CONTRIBUTING.md', 'LICENSE', 'README.md', 'SECURITY.md',
  'assets/banner.svg', 'assets/dashboard.png', 'assets/local-demo.gif',
  'docs/ARCHITECTURE.md', 'docs/BUSINESS_AND_RELEASE_PLAN.md', 'docs/INTEGRATIONS.md',
  'docs/PUBLIC_PREVIEW.md', 'docs/VALIDATION.md', 'docs/releases/v0.1.0.md', 'docs/updates/2026-10-20.md',
  'examples/catalog.json', 'package.json', 'public/app.js', 'public/index.html', 'public/styles.css',
  'scripts/check-demo.mjs', 'scripts/preview.mjs', 'scripts/source-archive.mjs',
  'src/adapters/apify.mjs', 'src/adapters/providers.mjs', 'src/artifact.mjs', 'src/cli.mjs',
  'src/ledger.mjs', 'src/runtime.mjs', 'src/server.mjs', 'src/service.mjs', 'src/spec.mjs', 'src/store.mjs',
  'test/adapters.test.mjs', 'test/core.test.mjs', 'test/run.mjs', 'test/server.test.mjs',
].sort();

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const manifestName = 'PREVIEW-MANIFEST.json';
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Stored ZIP entries avoid compression-version differences. Timestamps and permissions are fixed.
function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const encoded = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(encoded.length, 26);
    local.push(header, encoded, data);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(0x0314, 4);
    header.copy(record, 6, 4, 30);
    record.writeUInt32LE(0x81a40000, 38); record.writeUInt32LE(offset, 42);
    central.push(record, encoded);
    offset += header.length + encoded.length + data.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}

async function readPublicFile(root, name) {
  let target = root;
  const components = name.split('/');
  for (const [index, component] of components.entries()) {
    target = path.join(target, component);
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw new Error('Source allowlist rejects symbolic links: ' + name);
    if (index < components.length - 1 ? !info.isDirectory() : !info.isFile()) throw new Error('Expected a regular source file: ' + name);
  }
  const content = await readFile(target);
  return /\.(png|gif)$/.test(name) ? content : Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'));
}

export async function buildPreview(root) {
  root = path.resolve(root);
  if ((await lstat(root)).isSymbolicLink()) throw new Error('Source root cannot be a symbolic link.');
  const files = await Promise.all(SOURCE_FILES.map(async (name) => [name, await readPublicFile(root, name)]));
  const metadata = JSON.parse(files.find(([name]) => name === 'package.json')[1]);
  if (metadata.name !== 'quotaforge' || !/^\d+\.\d+\.\d+$/.test(metadata.version)) throw new Error('Invalid preview package metadata.');
  const basename = `quotaforge-v${metadata.version}-preview`;
  const manifest = {
    format: 1, name: metadata.name, version: metadata.version,
    normalization: 'UTF-8 text uses LF; binary assets are unchanged. ZIP timestamps are fixed at 1980-01-01 and modes are 0644.',
    files: files.map(([name, content]) => ({ path: name, bytes: content.length, sha256: sha256(content) })),
  };
  const entries = [...files, [manifestName, Buffer.from(JSON.stringify(manifest, null, 2) + '\n')]]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, content]) => [basename + '/' + name, content]);
  const archive = zip(entries);
  return { archive, filename: basename + '.zip', manifest, checksum: sha256(archive) };
}

export function verifyPreview(archive) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const bytes = archive.readUInt32LE(offset + 18), nameBytes = archive.readUInt16LE(offset + 26);
    const extraBytes = archive.readUInt16LE(offset + 28), start = offset + 30 + nameBytes + extraBytes;
    if (start + bytes > archive.length) throw new Error('Truncated preview archive.');
    const name = archive.subarray(offset + 30, offset + 30 + nameBytes).toString('utf8');
    entries.push([name, archive.subarray(start, start + bytes)]);
    offset = start + bytes;
  }
  if (!entries.length || !zip(entries).equals(archive)) throw new Error('Preview ZIP metadata or contents are noncanonical or corrupt.');
  const prefix = entries[0][0].split('/')[0];
  if (!/^quotaforge-v\d+\.\d+\.\d+-preview$/.test(prefix)) throw new Error('Unexpected preview root.');
  const files = new Map(entries.map(([name, data]) => [name.slice(prefix.length + 1), data]));
  const expected = [...SOURCE_FILES, manifestName].sort();
  if (files.size !== expected.length || entries.some(([name], index) => name !== prefix + '/' + expected[index])) throw new Error('Preview does not match the public source allowlist.');
  const manifest = JSON.parse(files.get(manifestName));
  const metadata = JSON.parse(files.get('package.json'));
  if (manifest.format !== 1 || manifest.name !== 'quotaforge' || manifest.version !== metadata.version || prefix !== `quotaforge-v${metadata.version}-preview`) throw new Error('Preview metadata does not agree.');
  const actual = SOURCE_FILES.map((name) => ({ path: name, bytes: files.get(name).length, sha256: sha256(files.get(name)) }));
  if (JSON.stringify(manifest.files) !== JSON.stringify(actual)) throw new Error('Preview manifest hashes do not match the source files.');
  return { prefix, files, manifest, checksum: sha256(archive) };
}

export async function extractPreview(archive, destination) {
  const checked = verifyPreview(archive);
  const directory = path.join(path.resolve(destination), checked.prefix);
  await mkdir(directory, { recursive: false });
  for (const [name, content] of checked.files) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
  }
  return directory;
}
