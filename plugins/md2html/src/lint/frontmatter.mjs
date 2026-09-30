// Report frontmatter: closed schema, required keys, ISO dates, edited >= created, status enum.
import { lintRule } from 'unified-lint-rule';
import { parseDocument, isMap, isScalar, isAlias } from 'yaml';
import { suggest } from '../util.mjs';

export const KEYS = ['title', 'created', 'edited', 'status', 'subtitle', 'description'];
export const REQUIRED = ['title', 'created', 'edited', 'status'];
export const STATUSES = ['research', 'ongoing', 'implemented'];
const DATE_KEYS = ['created', 'edited'];

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const frontmatter = lintRule('md2html:frontmatter', (tree, file) => {
  const node = tree.children.find((n) => n.type === 'yaml');
  if (!node) {
    file.message(`missing frontmatter. Required keys: ${REQUIRED.join(', ')}`, { line: 1, column: 1 });
    return;
  }
  // The YAML text starts on the line after the opening `---`.
  const at = (offset) => {
    const before = node.value.slice(0, offset);
    const nl = before.lastIndexOf('\n');
    return { line: node.position.start.line + 1 + (before.match(/\n/g)?.length ?? 0), column: offset - nl };
  };
  // Core schema (YAML 1.2): dates stay strings, as written.
  const doc = parseDocument(node.value, { schema: 'core', prettyErrors: false, logLevel: 'error' });
  if (doc.errors.length) {
    const err = doc.errors[0];
    const place = err.pos ? at(err.pos[0]) : node.position.start;
    // An unquoted `: ` inside a value (`subtitle: Report for spec: x`) is the usual cause.
    const line = err.pos && node.value.split('\n')[place.line - node.position.start.line - 1];
    const colon = line && /^([\w-]+):[ \t]+[^\s"'].*:\s/.exec(line);
    const hint = colon ? ` (line ${place.line}). Quote values that contain ": ", e.g. ${colon[1]}: "…"` : '';
    file.message(`frontmatter is not valid YAML: ${err.message.split('\n')[0]}${hint}`, err.pos ? place : node);
    return;
  }
  if (doc.contents === null && !node.value.trim()) {
    file.message(`frontmatter is empty. Required keys: ${REQUIRED.join(', ')}`, node);
    return;
  }
  if (!isMap(doc.contents)) {
    file.message('frontmatter must be a YAML mapping of keys to values', node);
    return;
  }
  const values = {};
  const places = {};
  const present = new Set();
  for (const pair of doc.contents.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
    const place = pair.key?.range ? at(pair.key.range[0]) : node;
    if (!KEYS.includes(key)) {
      const near = suggest(key, KEYS);
      file.message(`unknown frontmatter key "${key}".${near ? ` Did you mean "${near}"?` : ` Allowed: ${KEYS.join(', ')}`}`, place);
      continue;
    }
    present.add(key);
    // `*x` is an alias (its value throws when unresolved) and `&x` an anchor: both almost always
    // mean an unquoted `*emphasis*` or `&` at the start of the value.
    const mark = isAlias(pair.value) ? ['*', 'an alias'] : pair.value?.anchor ? ['&', 'an anchor'] : null;
    if (mark) {
      const line = node.value.slice(pair.key.range[1]).split('\n')[0];
      const lead = /^\s*:\s*/.exec(line)[0].length;
      const raw = line.slice(lead).trim();
      file.message(`"${key}" starts with "${mark[0]}", which YAML reads as ${mark[1]}; quote the value: ${key}: ${JSON.stringify(raw)}`, at(pair.key.range[1] + lead));
      continue;
    }
    values[key] = isScalar(pair.value) ? pair.value.value : pair.value?.toJSON?.() ?? null;
    places[key] = pair.value?.range ? at(pair.value.range[0]) : place;
  }
  for (const key of REQUIRED) {
    if (!present.has(key)) file.message(`missing required frontmatter key "${key}"`, node.position.start);
  }
  for (const key of ['title', 'subtitle', 'description']) {
    if (key in values && (typeof values[key] !== 'string' || !values[key].trim())) {
      file.message(`"${key}" must be a non-empty string`, places[key]);
    }
  }
  for (const key of DATE_KEYS) {
    if (key in values && !isIsoDate(values[key])) {
      file.message(`"${key}" must be an ISO date (YYYY-MM-DD), got "${values[key] ?? ''}"`, places[key]);
    }
  }
  if (isIsoDate(values.created) && isIsoDate(values.edited) && values.edited < values.created) {
    file.message(`"edited" (${values.edited}) is before "created" (${values.created})`, places.edited);
  }
  if ('status' in values && !STATUSES.includes(values.status)) {
    file.message(`status "${values.status ?? ''}" is not allowed. Use ${STATUSES.join(' | ')}`, places.status);
  }
});
