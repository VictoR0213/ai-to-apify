const banned = new Set(['__proto__', 'constructor', 'prototype']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function assert(condition, message) { if (!condition) throw new Error(message); }
function exactKeys(object, keys, label) {
  assert(plain(object), label + ' must be an object.');
  assert(Object.keys(object).every((key) => keys.includes(key)), label + ' contains unsupported properties.');
}
function keyName(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value) && !banned.has(value);
}
export function validateSpec(spec) {
  exactKeys(spec, ['name', 'title', 'description', 'fields', 'dedupeBy', 'sortBy'], 'Tool spec');
  assert(typeof spec.name === 'string' && /^[a-z][a-z0-9-]{2,47}$/.test(spec.name), 'Use a 3–48 character lowercase slug.');
  assert(typeof spec.title === 'string' && spec.title.length > 0 && spec.title.length <= 100, 'Title must contain 1–100 characters.');
  assert(typeof spec.description === 'string' && spec.description.length > 0 && spec.description.length <= 1000, 'Description must contain 1–1000 characters.');
  assert(Array.isArray(spec.fields) && spec.fields.length > 0 && spec.fields.length <= 32, 'Specify 1–32 fields.');
  const targets = new Set();
  for (const field of spec.fields) {
    exactKeys(field, ['source', 'target', 'type', 'trim', 'case', 'required'], 'Field');
    assert(keyName(field.source) && keyName(field.target), 'Field names must be safe, flat identifiers.');
    assert(!targets.has(field.target), 'Duplicate target field: ' + field.target);
    targets.add(field.target);
    assert(['string', 'number', 'boolean'].includes(field.type), 'Unsupported field type.');
    assert(typeof field.trim === 'boolean' && typeof field.required === 'boolean', 'trim and required must be booleans.');
    assert(['preserve', 'lower', 'upper'].includes(field.case), 'Unsupported case conversion.');
    assert(field.type === 'string' || (!field.trim && field.case === 'preserve'), 'Non-string fields cannot apply text operations.');
  }
  assert(Array.isArray(spec.dedupeBy) && spec.dedupeBy.length <= spec.fields.length, 'dedupeBy must list output fields.');
  assert(new Set(spec.dedupeBy).size === spec.dedupeBy.length && spec.dedupeBy.every((key) => targets.has(key)), 'Invalid deduplication fields.');
  assert(spec.sortBy === null || targets.has(spec.sortBy), 'sortBy must be an output field or null.');
  return spec;
}
function convert(value, field, rowIndex) {
  if (value === null || value === undefined || value === '') {
    if (field.required) throw new Error('Row ' + rowIndex + ': missing required field ' + field.source);
    return null;
  }
  assert(['string', 'number', 'boolean'].includes(typeof value), 'Row ' + rowIndex + ': only primitive values are supported.');
  if (field.type === 'number') {
    assert(typeof value !== 'boolean' && !(typeof value === 'string' && value.trim() === ''), 'Invalid number in ' + field.source);
    const converted = Number(value);
    assert(Number.isFinite(converted), 'Invalid number in ' + field.source);
    return converted;
  }
  if (field.type === 'boolean') {
    if (value === true || value === 'true' || value === 1) return true;
    if (value === false || value === 'false' || value === 0) return false;
    throw new Error('Invalid boolean in ' + field.source);
  }
  let converted = String(value);
  assert(converted.length <= 8192, 'Field value exceeds 8192 characters.');
  if (field.trim) converted = converted.trim();
  if (field.required) assert(converted.length > 0, 'Empty required field ' + field.source);
  if (field.case === 'lower') converted = converted.toLowerCase();
  if (field.case === 'upper') converted = converted.toUpperCase();
  return converted;
}
export function transformRecords(spec, input) {
  validateSpec(spec);
  exactKeys(input, ['records'], 'Input');
  assert(Array.isArray(input.records) && input.records.length <= 10000, 'Input must contain at most 10,000 records.');
  const seen = new Set();
  const records = [];
  for (const [index, source] of input.records.entries()) {
    assert(plain(source), 'Row ' + index + ' must be an object.');
    const row = {};
    for (const field of spec.fields) row[field.target] = convert(Object.hasOwn(source, field.source) ? source[field.source] : undefined, field, index);
    if (spec.dedupeBy.length) {
      const key = JSON.stringify(spec.dedupeBy.map((field) => row[field]));
      if (seen.has(key)) continue;
      seen.add(key);
    }
    records.push(row);
  }
  if (spec.sortBy) {
    const field = spec.sortBy;
    records.sort((a, b) => a[field] === b[field] ? 0 : a[field] === null ? 1 : b[field] === null ? -1 : a[field] < b[field] ? -1 : 1);
  }
  return {
    records,
    stats: { inputRows: input.records.length, outputRows: records.length, duplicatesRemoved: input.records.length - records.length },
  };
}
export function toCSV(spec, records) {
  const headers = spec.fields.map((field) => field.target);
  const escape = (value) => {
    let text = value === null || value === undefined ? '' : String(value);
    // Prevent common spreadsheet formula injection when CSV is opened interactively.
    if (/^[\s]*[=+\-@]/.test(text) && typeof value !== 'number') text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [headers.map(escape).join(','), ...records.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\r\n') + '\r\n';
}
