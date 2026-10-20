import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const empty = () => ({ version: 1, projects: [], ledger: [] });
export class Store {
  constructor(root) { this.root = path.resolve(root); this.file = path.join(this.root, 'state.json'); }
  async read() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.projects) || !Array.isArray(data.ledger)) throw new Error('Unsupported state file format.');
      return data;
    } catch (error) { if (error.code === 'ENOENT') return empty(); throw error; }
  }
  async update(callback) {
    await mkdir(this.root, { recursive: true });
    const lockPath = path.join(this.root, 'state.lock');
    let lock;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { lock = await open(lockPath, 'wx'); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (attempt === 99) throw new Error('State is locked by another process. Close other QuotaForge tasks; inspect state.lock if a process crashed.');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    try {
      await lock.writeFile(String(process.pid));
      const state = await this.read();
      const result = await callback(state);
      await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, this.file);
      return result;
    } finally {
      await lock.close();
      await unlink(lockPath).catch(() => {});
      await unlink(temporary).catch(() => {});
    }
  }
}
