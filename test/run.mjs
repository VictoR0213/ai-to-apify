import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const folder = fileURLToPath(new URL('.', import.meta.url));
const files = (await readdir(folder)).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => fileURLToPath(new URL(name, import.meta.url)));
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit', shell: false, windowsHide: true });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
