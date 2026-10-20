export const toolSpecSchema = {
  type: 'object', additionalProperties: false,
  required: ['name', 'title', 'description', 'fields', 'dedupeBy', 'sortBy'],
  properties: {
    name: { type: 'string', pattern: '^[a-z][a-z0-9-]{2,47}$' },
    title: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', minLength: 1, maxLength: 1000 },
    fields: { type: 'array', minItems: 1, maxItems: 32, items: {
      type: 'object', additionalProperties: false, required: ['source', 'target', 'type', 'trim', 'case', 'required'],
      properties: {
        source: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$' },
        target: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$' },
        type: { type: 'string', enum: ['string', 'number', 'boolean'] },
        trim: { type: 'boolean' }, case: { type: 'string', enum: ['preserve', 'lower', 'upper'] },
        required: { type: 'boolean' },
      },
    }},
    dedupeBy: { type: 'array', items: { type: 'string' } },
    sortBy: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
};
export const example = {
  name: 'public-catalog-cleaner',
  brief: 'Normalize a public catalog: map title to name and trim it; trim and lowercase category; trim url; convert price to a number. name, category and url are required; price is optional. Keep the first record for each url, then sort by name ascending.',
  fixtures: [
    { name: 'Normalize, deduplicate and sort', input: { records: [
      { title: ' Beta ', category: ' TOOLS ', url: ' https://example.org/b ', price: '2.5' },
      { title: ' Alpha ', category: ' DATA ', url: 'https://example.org/a', price: '0' },
      { title: 'Beta duplicate', category: 'tools', url: 'https://example.org/b', price: 7 },
    ]}, expected: [
      { name: 'Alpha', category: 'data', url: 'https://example.org/a', price: 0 },
      { name: 'Beta', category: 'tools', url: 'https://example.org/b', price: 2.5 },
    ]},
    { name: 'Empty catalog', input: { records: [] }, expected: [] },
    { name: 'Missing optional price', input: { records: [{ title: 'Gamma', category: 'TOOLS', url: 'https://example.org/c' }] }, expected: [
      { name: 'Gamma', category: 'tools', url: 'https://example.org/c', price: null },
    ]},
  ],
};
export function demoSpec(name = example.name) {
  return {
    name, title: 'Public Catalog Cleaner',
    description: 'Normalize public catalog fields, remove duplicate URLs and export sorted JSON or CSV.',
    fields: [
      { source: 'title', target: 'name', type: 'string', trim: true, case: 'preserve', required: true },
      { source: 'category', target: 'category', type: 'string', trim: true, case: 'lower', required: true },
      { source: 'url', target: 'url', type: 'string', trim: true, case: 'preserve', required: true },
      { source: 'price', target: 'price', type: 'number', trim: false, case: 'preserve', required: false },
    ],
    dedupeBy: ['url'], sortBy: 'name',
  };
}
