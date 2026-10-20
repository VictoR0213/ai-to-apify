import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateSpec } from './runtime.mjs';
const json = (value) => JSON.stringify(value, null, 2) + '\n';
export const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export async function buildArtifact(project) {
  validateSpec(project.spec);
  const spec = project.spec;
  const files = [
    { name: 'package.json', content: json({
      name: spec.name, version: '0.1.0', type: 'module', private: true,
      engines: { node: '>=22' }, scripts: { start: 'node src/main.mjs', test: 'node --test test/*.test.mjs' },
      dependencies: { apify: '3.7.2' },
    }) },
    { name: 'Dockerfile', content: 'FROM apify/actor-node:22\nCOPY package*.json ./\nRUN npm install --omit=dev --ignore-scripts\nCOPY . ./\nRUN node --test test/*.test.mjs\nCMD ["node", "src/main.mjs"]\n' },
    { name: '.actor/actor.json', content: json({
      actorSpecification: 1, name: spec.name, title: spec.title, description: spec.description,
      version: '0.1', buildTag: 'latest', dockerfile: '../Dockerfile', input: './input_schema.json',
      output: './output_schema.json', storages: { dataset: './dataset_schema.json' },
    }) },
    { name: '.actor/input_schema.json', content: json({
      title: spec.title, type: 'object', schemaVersion: 1,
      properties: { records: { title: 'Public catalog records', type: 'array', editor: 'json', description: 'An array of up to 10,000 public records. Only primitive field values are supported.', prefill: project.fixtures[0].input.records } },
      required: ['records'],
    }) },
    { name: '.actor/output_schema.json', content: json({
      actorOutputSchemaVersion: 1, title: 'Normalized catalog output',
      properties: { results: { type: 'string', title: 'Normalized records', description: 'Delivered normalized records in the default dataset.', template: '{{links.apiDefaultDatasetUrl}}/items' } },
    }) },
    { name: '.actor/dataset_schema.json', content: json({
      actorSpecification: 1,
      fields: {
        type: 'object', additionalProperties: false,
        properties: Object.fromEntries(spec.fields.map((field) => [field.target, { type: field.required ? field.type : [field.type, 'null'], description: 'Normalized value from ' + field.source + '.' }])),
        required: spec.fields.map((field) => field.target),
      },
      views: { overview: {
        title: 'Normalized records', transformation: { fields: spec.fields.map((field) => field.target) },
        display: { component: 'table', properties: Object.fromEntries(spec.fields.map((field) => [field.target, { label: field.target, format: field.type === 'string' ? 'text' : field.type }])) },
      } },
    }) },
    { name: 'src/spec.json', content: json(spec) },
    { name: 'src/runtime.mjs', content: await readFile(new URL('./runtime.mjs', import.meta.url), 'utf8') },
    { name: 'src/main.mjs', content: [
      "import { Actor } from 'apify';",
      "import { readFile } from 'node:fs/promises';",
      "import { transformRecords } from './runtime.mjs';",
      "const spec = JSON.parse(await readFile(new URL('./spec.json', import.meta.url), 'utf8'));",
      "await Actor.main(async () => {",
      "  const input = await Actor.getInput();",
      "  const result = transformRecords(spec, input);",
      "  // The SDK couples dataset delivery with the configured billing event and charge limits.",
      "  if (result.records.length) await Actor.pushData(result.records, 'record-normalized');",
      "  await Actor.setValue('SUMMARY', { inputRows: result.stats.inputRows, candidateRows: result.records.length, note: 'Use the default dataset for delivered records. Configured charge limits may limit delivery.' });",
      "});", '',
    ].join('\n') },
    { name: 'test/fixtures.json', content: json(project.fixtures) },
    { name: 'test/tool.test.mjs', content: [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { readFile } from 'node:fs/promises';",
      "import { transformRecords } from '../src/runtime.mjs';",
      "const spec = JSON.parse(await readFile(new URL('../src/spec.json', import.meta.url), 'utf8'));",
      "const fixtures = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url), 'utf8'));",
      "for (const fixture of fixtures) test(fixture.name, () => assert.deepEqual(transformRecords(spec, fixture.input).records, fixture.expected));", '',
    ].join('\n') },
    { name: 'README.md', content: [
      '# ' + spec.title, '', spec.description, '',
      '## Input', '', 'Supply a JSON object with a records array. Records must be public or yours to process. This tool does not crawl websites or fetch URLs.', '',
      '## Output', '', 'The default dataset contains normalized records and can be exported as JSON or CSV in Apify Console. Duplicate removal keeps the first matching input record. Null sort values are last.', '',
      '## Billing', '', 'The code emits the record-normalized event per delivered record through the official Apify SDK. Publishing does not activate paid pricing. Configure this exact event and its price in Apify Console, complete identity/payout setup, and review platform costs before enabling charges. Empty output does not emit this event.', '',
      '## Validation', '', 'The included fixtures were fixed before generation and are checked during the container build. Passing them does not guarantee correctness for every input, customer demand, or revenue.', '',
      '## Limits', '', 'Up to 10,000 input records and 32 flat fields. Types: string, number, boolean. Invalid required values fail before delivery. No arbitrary code, nested field expressions or network input sources.', '',
    ].join('\n') },
  ];
  const artifactHash = digest(files.map(({ name, content }) => ({ name, content })));
  return { projectId: project.id, artifactHash, files, publicationChecklist: [
    'Review all source files and fixed fixture expectations.',
    'Deploy privately and wait for a successful cloud build.',
    'Run the cloud fixture check through QuotaForge and review its dataset.',
    'Complete KYC and payout details in Apify Console.',
    'Configure pay-per-event pricing for record-normalized; evaluate platform costs.',
    'Confirm public publication. Public does not automatically mean paid.',
  ] };
}
export async function saveArtifact(root, artifact) {
  const directory = path.join(root, 'artifacts', artifact.projectId);
  for (const file of artifact.files) {
    const target = path.join(directory, file.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
  await writeFile(path.join(directory, 'quotaforge-manifest.json'), json({ artifactHash: artifact.artifactHash, publicationChecklist: artifact.publicationChecklist }));
  return directory;
}
