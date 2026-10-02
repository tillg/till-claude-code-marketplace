// Spec frontmatter: closed schema (feature, title, status, order, created, edited), `feature` =
// change directory, status enum, ISO dates, edited >= created; plus the cross-file group check.
import { lintRule } from 'unified-lint-rule';
import { parseDocument, isMap, isScalar, isAlias } from 'yaml';
import { suggest } from '../util.mjs';
import { reportPath } from './fs.mjs';

export const SPEC_KEYS = ['feature', 'title', 'status', 'order', 'created', 'edited'];
export const SPEC_STATUSES = ['exploring', 'proposed', 'applying', 'applied'];
const ALWAYS = ['title', 'created', 'edited'];
const CHANGE_ONLY = ['feature', 'status'];
const DATE_KEYS = ['created', 'edited'];

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** `<dir>` for a root-relative path under `specs/changes/<dir>/` or `specs/changes/archive/<dir>/`, else null. */
export function changeDir(file) {
  return /(?:^|\/)specs\/changes\/(?:archive\/)?([^/]+)\/./.exec(String(file).replace(/\\/g, '/'))?.[1] ?? null;
}

/**
 * The frontmatter of a parsed mdast `yaml` node: `{ error?, empty?, notMap?, pairs }`, where each
 * pair is `{ key, value, keyAt, valueAt, mark? }` with 1-based `{line, column}` places. Never throws.
 */
function readYaml(node) {
  const at = (offset) => {
    const before = node.value.slice(0, offset);
    const nl = before.lastIndexOf('\n');
    return { line: node.position.start.line + 1 + (before.match(/\n/g)?.length ?? 0), column: offset - nl };
  };
  const doc = parseDocument(node.value, { schema: 'core', prettyErrors: false, logLevel: 'error' });
  if (doc.errors.length) {
    const err = doc.errors[0];
    return { error: err.message.split('\n')[0], errorAt: err.pos ? at(err.pos[0]) : node.position.start, pairs: [] };
  }
  if (doc.contents === null && !node.value.trim()) return { empty: true, pairs: [] };
  if (!isMap(doc.contents)) return { notMap: true, pairs: [] };
  const pairs = doc.contents.items.map((pair) => {
    const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
    const keyAt = pair.key?.range ? at(pair.key.range[0]) : node.position.start;
    const mark = isAlias(pair.value) ? ['*', 'an alias'] : pair.value?.anchor ? ['&', 'an anchor'] : null;
    let value = null;
    if (!mark) {
      try { value = isScalar(pair.value) ? pair.value.value : pair.value?.toJSON?.() ?? null; } catch { value = null; }
    }
    return { key, value, keyAt, valueAt: pair.value?.range ? at(pair.value.range[0]) : keyAt, mark };
  });
  return { pairs };
}

const yamlNode = (tree) => tree.children.find((n) => n.type === 'yaml');

/** Errors: the frontmatter contract. Options: `{file}` (root-relative) for the change-dir checks. */
export const specFrontmatter = lintRule('md2html:spec-frontmatter', (tree, file, options) => {
  const node = yamlNode(tree);
  if (!node) return; // specFrontmatterHints warns
  const dir = changeDir(reportPath(options, file));
  const required = dir ? [...CHANGE_ONLY, ...ALWAYS] : ALWAYS;
  const y = readYaml(node);
  if (y.error) {
    // An unquoted `: ` inside a value (`title: Proposal: add x`) is the usual cause.
    const line = node.value.split('\n')[y.errorAt.line - node.position.start.line - 1];
    const colon = line && /^([\w-]+):[ \t]+[^\s"'].*:\s/.exec(line);
    const hint = colon ? ` (line ${y.errorAt.line}). Quote values that contain ": ", e.g. ${colon[1]}: "…"` : '';
    return void file.message(`frontmatter is not valid YAML: ${y.error}${hint}`, y.errorAt);
  }
  if (y.empty) return void file.message(`frontmatter is empty. Required keys: ${required.join(', ')}`, node);
  if (y.notMap) return void file.message('frontmatter must be a YAML mapping of keys to values', node);
  const values = {};
  const places = {};
  for (const p of y.pairs) {
    if (!SPEC_KEYS.includes(p.key)) {
      const near = suggest(p.key, SPEC_KEYS);
      file.message(`unknown frontmatter key "${p.key}".${near ? ` Did you mean "${near}"?` : ` Allowed: ${SPEC_KEYS.join(', ')}`}`, p.keyAt);
      continue;
    }
    if (p.mark) {
      file.message(`"${p.key}" starts with "${p.mark[0]}", which YAML reads as ${p.mark[1]}; quote the value`, p.valueAt);
      places[p.key] = p.valueAt;
      continue;
    }
    values[p.key] = p.value;
    places[p.key] = p.valueAt;
  }
  for (const key of required) {
    if (!(key in places)) file.message(`missing required frontmatter key "${key}"`, node.position.start);
  }
  if ('title' in values && (typeof values.title !== 'string' || !values.title.trim())) {
    file.message('"title" must be a non-empty string', places.title);
  }
  if ('feature' in values) {
    if (typeof values.feature !== 'string' || !values.feature.trim()) file.message('"feature" must be a non-empty string', places.feature);
    else if (dir && values.feature !== dir) file.message(`feature "${values.feature}" must equal the change directory name "${dir}"`, places.feature);
  }
  if ('status' in values && !SPEC_STATUSES.includes(values.status)) {
    file.message(`status "${values.status ?? ''}" is not allowed. Use ${SPEC_STATUSES.join(' | ')}`, places.status);
  }
  if ('order' in values && !(Number.isInteger(values.order) && values.order >= 0)) {
    file.message(`"order" must be an integer ≥ 0, got "${values.order ?? ''}"`, places.order);
  }
  for (const key of DATE_KEYS) {
    if (key in values && !isIsoDate(values[key])) {
      file.message(`"${key}" must be an ISO date (YYYY-MM-DD), got "${values[key] ?? ''}"`, places[key]);
    }
  }
  if (isIsoDate(values.created) && isIsoDate(values.edited) && values.edited < values.created) {
    file.message(`"edited" (${values.edited}) is before "created" (${values.created})`, places.edited);
  }
});

/** Warnings: no frontmatter at all (legacy files), keys out of the canonical order. */
export const specFrontmatterHints = lintRule('md2html:spec-frontmatter', (tree, file) => {
  const node = yamlNode(tree);
  if (!node) return void file.message('add spec frontmatter (feature, title, status, created, edited)', { line: 1, column: 1 });
  const known = readYaml(node).pairs.filter((p) => SPEC_KEYS.includes(p.key));
  for (let i = 1; i < known.length; i++) {
    const prev = known[i - 1];
    if (SPEC_KEYS.indexOf(known[i].key) < SPEC_KEYS.indexOf(prev.key)) {
      file.message(`"${known[i].key}" should come before "${prev.key}" (order: ${SPEC_KEYS.join(', ')})`, known[i].keyAt);
    }
  }
});

/**
 * Values and lines of the spec frontmatter of one mdast tree (the input `lintSpecGroup` items are
 * built from): `{ feature, title, status, order, created, edited, lines: {key: line} }` with only
 * the keys present, or null when the file has no (readable) frontmatter.
 */
export function specFrontmatterData(tree) {
  const node = yamlNode(tree);
  if (!node) return null;
  const y = readYaml(node);
  if (y.error || y.empty || y.notMap) return null;
  const data = { lines: {} };
  for (const p of y.pairs) {
    if (!SPEC_KEYS.includes(p.key) || p.key in data.lines) continue;
    if (!p.mark) data[p.key] = p.value;
    data.lines[p.key] = p.keyAt.line;
  }
  return data;
}

/** Most common value; ties go to the value of the item with the lowest `order`, then list order. */
function majority(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(e.value, (counts.get(e.value) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const tied = new Set([...counts].filter(([, n]) => n === top).map(([v]) => v));
  const rank = (e) => (Number.isInteger(e.item.order) ? e.item.order : Infinity);
  const first = entries.map((e, i) => ({ e, i })).filter(({ e }) => tied.has(e.value))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)[0];
  return first.e.value;
}

/**
 * Cross-file check for one group: items `[{file, feature, status, order?, line?, lines?}]`.
 * Each file whose `feature` or `status` differs from the group's majority gets one error at that
 * key's line (`lines[key]`, else `line`, else 1). Missing values are ignored (per-file lint flags
 * them). Returns `[{file, line, column, severity, message, ruleId}]`, sorted by file, line, key.
 */
export function specGroupMessages(items) {
  const out = [];
  for (const key of ['feature', 'status']) {
    const entries = items.filter((item) => item[key] !== undefined && item[key] !== null).map((item) => ({ item, value: item[key] }));
    if (new Set(entries.map((e) => e.value)).size < 2) continue;
    const common = majority(entries);
    for (const { item, value } of entries) {
      if (value === common) continue;
      const slash = item.file.lastIndexOf('/');
      const dir = slash < 0 ? './' : item.file.slice(0, slash + 1);
      out.push({
        file: item.file, line: item.lines?.[key] ?? item.line ?? 1, column: 1, severity: 'error',
        message: `${key} "${value}" differs from the rest of ${dir} ("${common}")`, ruleId: 'spec-consistency',
      });
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || a.column - b.column);
}
