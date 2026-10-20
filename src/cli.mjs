#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { QuotaForge } from './service.mjs';
import { startServer } from './server.mjs';

try { loadEnvFile(path.resolve('.env')); } catch (error) { if (error.code !== 'ENOENT') { console.error('Could not load .env. Check its format and permissions.'); process.exit(1); } }
const args = process.argv.slice(2);
const command = args.shift() || 'help';
const flag = (name) => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
const print = (value) => console.log(JSON.stringify(value, null, 2));
const help = [
  'QuotaForge — local AI tool workshop',
  '',
  'node src/cli.mjs serve [--port 4317]',
  'node src/cli.mjs doctor',
  'node src/cli.mjs demo',
  'node src/cli.mjs create --file examples/catalog.json',
  'node src/cli.mjs list',
  'node src/cli.mjs generate <project-id> --provider codex|claude|demo',
  'node src/cli.mjs test <project-id>',
  'node src/cli.mjs artifact <project-id> [--out path]',
  'node src/cli.mjs deploy <project-id> --confirm',
  'node src/cli.mjs smoke <project-id> --confirm',
  'node src/cli.mjs publish <project-id> --confirm',
  'node src/cli.mjs sync <project-id>',
  'node src/cli.mjs ledger add --project <id> --kind payout|expense|pending --amount <USD> --reference <receipt> --date YYYY-MM-DD [--settles <pending-reference>] [--note text]',
  '',
  'No npm install is required for the dashboard or tests. Demo makes no model or cloud calls.',
  'APIFY_TOKEN is optional until deployment. Authenticate model CLIs using their official flows.',
].join('\n');
try {
  if (command === 'help' || command === '--help' || command === '-h') console.log(help);
  else {
    const service = new QuotaForge();
    if (command === 'serve') {
      const server = await startServer({ service, ...(flag('port') ? { port: Number(flag('port')) } : {}) });
      console.log('QuotaForge is ready: http://127.0.0.1:' + server.address().port);
      console.log('Local data: ' + service.store.root);
      console.log('No model calls, uploads or publishing happen until you request them.');
      const stop = () => { server.close(); server.closeIdleConnections(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    } else if (command === 'doctor') {
      const state = await service.state();
      print({ node: process.version, providers: state.providers, apifyConfigured: state.apifyConfigured, dataDirectory: service.store.root, note: 'CLI detection checks installation only, not authentication or remaining quota.' });
    } else if (command === 'demo') {
      const project = await service.demo();
      print({ id: project.id, name: project.name, status: project.status, tests: project.verification, artifactDirectory: path.join(service.store.root, 'artifacts', project.id), note: 'Deterministic local demo. No AI, cloud deployment or revenue has been simulated.' });
    } else if (command === 'create') {
      if (!flag('file')) throw new Error('Provide --file with a project brief and fixtures JSON file.');
      print(await service.create(JSON.parse(await readFile(path.resolve(flag('file')), 'utf8'))));
    } else if (command === 'list') {
      print((await service.store.read()).projects);
    } else if (command === 'generate') {
      print(await service.generate(args[0], flag('provider')));
    } else if (command === 'test') {
      const project = await service.test(args[0]); print(project.verification);
      if (!project.verification.passed) process.exitCode = 1;
    } else if (command === 'artifact') {
      const artifact = await service.artifact(args[0]);
      if (flag('out')) {
        const directory = path.resolve(flag('out'));
        await mkdir(directory, { recursive: true });
        for (const file of artifact.files) {
          const target = path.join(directory, file.name);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, file.content, { encoding: 'utf8', flag: 'wx' });
        }
        print({ directory, artifactHash: artifact.artifactHash, checklist: artifact.publicationChecklist });
      } else print(artifact);
    } else if (['deploy', 'publish', 'sync', 'smoke'].includes(command)) {
      print(await service[command](args[0], args.includes('--confirm')));
    } else if (command === 'ledger' && args[0] === 'add') {
      print(await service.addEntry({ projectId: flag('project'), kind: flag('kind'), amountUsd: Number(flag('amount')), reference: flag('reference'), occurredAt: flag('date'), note: flag('note') || '', settlesReference: flag('settles') || null }));
    } else throw new Error('Unknown command. Run node src/cli.mjs --help.');
  }
} catch (error) {
  console.error('Error: ' + String(error.message || error).replace(/apify_api_[A-Za-z0-9_-]+/g, '[REDACTED]'));
  process.exitCode = 1;
}
