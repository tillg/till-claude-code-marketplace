// fmt: rewrite a report into canonical form (see domain.md "Canonical form").
// parse → normalize → remark-stringify(STRINGIFY_OPTIONS). Prose is never re-wrapped, and
// text is re-emitted from its source slice so authors' escapes are neither added nor removed.
// A re-parse must give the same tree. Where it doesn't, the offending top-level block falls back
// to remark-stringify's own escaping, then to its original source bytes (F8).
import { isDeepStrictEqual } from 'node:util';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import remarkStringify from 'remark-stringify';
import YAML from 'yaml';
import { parse, normalizeInput, STRINGIFY_OPTIONS } from './processor.mjs';
import { entryFor, attrProblems } from './registry.mjs';

export const FRONTMATTER_ORDER = ['title', 'created', 'edited', 'status', 'subtitle', 'description'];

const DIRECTIVE_TYPES = new Set(['containerDirective', 'leafDirective', 'textDirective']);
const CALLOUT = /^\[!tldr\](?![+-])[^\S\n]*\n?/i;

/** Canonical form of a report source. Idempotent: format(format(x)) === format(x). */
export function format(source) {
  const src = normalizeInput(source);
  try {
    return canonical(src);
  } catch {
    return src.replace(/\n+$/, '') + '\n'; // fmt never throws: leave what it can't handle as written
  }
}

function canonical(src) {
  const orig = parse(src);
  const tree = structuredClone(orig);
  normalize(tree, src);
  // Per top-level block: RAW (source-slice text), then ESCAPED (library escaping), then SOURCE
  // (the block's original bytes). Upgrade the first block whose re-parse differs until none does.
  const choices = tree.children.map(() => RAW);
  for (;;) {
    const out = serialize(tree, orig, src, choices);
    const expected = tree.children.map((c, i) => (choices[i] === SOURCE ? orig.children[i] : c));
    const got = parse(out).children;
    let i = expected.findIndex((c, j) => !sameTree(c, got[j]));
    if (i < 0 && got.length === expected.length) return out.replace(/\n+$/, '') + '\n';
    if (i < 0) i = expected.length - 1;
    while (i >= 0 && choices[i] === SOURCE) i--;
    if (i < 0) return src.replace(/\n+$/, '') + '\n';
    choices[i]++;
  }
}

const RAW = 0;
const ESCAPED = 1;
const SOURCE = 2;

// ---------------------------------------------------------------- normalizers

function normalize(tree, src) {
  walk(tree, (node, parent, index) => {
    if (node.type === 'yaml') node.value = formatYaml(node.value);
    else if (node.type === 'blockquote') calloutToTldr(node, parent, index, src);
    else if (DIRECTIVE_TYPES.has(node.type)) orderAttributes(node);
  });
}

/** Keys in schema order, then unknown keys in original order; unneeded quotes dropped. Never throws. */
export function formatYaml(value) {
  try {
    return reorderYaml(value);
  } catch {
    return value; // e.g. an unresolved alias (`subtitle: *Draft*`) throws in toString()
  }
}

const YAML_OPTS = { logLevel: 'error' }; // no `YAMLWarning`s on stderr

function reorderYaml(value) {
  const doc = YAML.parseDocument(value, YAML_OPTS);
  if (doc.errors.length || doc.warnings.length || !YAML.isMap(doc.contents)) return value;
  // `lineWidth: 0` would join the lines of a multi-line scalar: leave such frontmatter as is.
  let multiline = false;
  YAML.visit(doc, {
    Scalar(_, node) {
      if (node.range && value.slice(node.range[0], node.range[1]).trimEnd().includes('\n')) multiline = true;
    },
  });
  if (multiline) return value;
  const rank = (pair) => {
    const i = FRONTMATTER_ORDER.indexOf(YAML.isScalar(pair.key) ? pair.key.value : pair.key);
    return i < 0 ? FRONTMATTER_ORDER.length : i;
  };
  doc.contents.items = doc.contents.items
    .map((pair, i) => [pair, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([pair]) => pair);
  YAML.visit(doc, {
    Scalar(_, node) {
      // PLAIN is only a preference: `yaml` still quotes when the plain form would not round-trip.
      if (typeof node.value === 'string' && (node.type === 'QUOTE_DOUBLE' || node.type === 'QUOTE_SINGLE')) node.type = 'PLAIN';
    },
  });
  const out = doc.toString({ lineWidth: 0 }).replace(/\n+$/, '');
  return isDeepStrictEqual(YAML.parse(out, YAML_OPTS), YAML.parse(value, YAML_OPTS)) ? out : value;
}

/** `> [!tldr] rest` (any case) → `:::tldr` holding the rest of the blockquote. */
function calloutToTldr(node, parent, index, src) {
  const para = node.children[0];
  const text = para?.type === 'paragraph' && para.children[0];
  if (!text || text.type !== 'text') return;
  const m = CALLOUT.exec(text.value);
  if (!m) return;
  text.value = text.value.slice(m[0].length);
  // Keep the source slice in step with the value (raw emission). Skip the marker in the *source*:
  // its trailing blanks (`[!tldr]\t`) are not in the value, then the next line's `> `/indent.
  const off = text.position?.start.offset;
  if (off !== undefined) {
    const skip = /^\[!tldr\][^\S\n]*(?:\n[ \t>]*)?/i.exec(src.slice(off));
    if (skip) text.position = { ...text.position, start: { ...text.position.start, offset: off + skip[0].length } };
    else delete text.position; // marker not written literally (e.g. `&#91;!tldr]`): library escaping
  }
  if (text.value === '') para.children.shift();
  if (para.children.length === 0) node.children.shift();
  parent.children[index] = { type: 'containerDirective', name: 'tldr', attributes: {}, children: node.children };
}

function orderAttributes(node) {
  const d = entryFor(node);
  if (!d || !node.attributes) return;
  const ordered = {};
  for (const key of Object.keys(d.attrs)) if (key in node.attributes) ordered[key] = node.attributes[key];
  node.attributes = { ...ordered, ...node.attributes };
}

// ---------------------------------------------------------------- serialization

function stringifier(src) {
  // A verbatim directive keeps its source line spacing to its neighbours (no blank line inserted
  // after a `:::cards` whose fence the inner card closed, F14).
  const end = (n) => n.span?.[1] ?? n.position?.end.offset;
  const start = (n) => n.span?.[0] ?? n.position?.start.offset;
  const join = (left, right) => {
    if (!left.span && !right.span) return undefined;
    const a = end(left);
    const b = start(right);
    return a !== undefined && b !== undefined && a <= b && !/\n[ \t>]*\n/.test(src.slice(a, b)) ? 0 : undefined;
  };
  return unified()
    .use(remarkStringify, { ...STRINGIFY_OPTIONS, join: [join], handlers: { fmtRaw: (node) => node.value } })
    .use(remarkGfm, { tablePipeAlign: false })
    .use(canonicalTables)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkDirective);
}

/** Wrap remark-gfm's table handler: delimiter cells `---`, `:---`, `---:`, `:---:` (F9). */
function canonicalTables() {
  const exts = this.data('toMarkdownExtensions');
  const find = (e) => e.handlers?.table || e.extensions?.map(find).find(Boolean);
  const table = exts.map(find).find(Boolean);
  exts.push({
    handlers: {
      table(...args) {
        const lines = table(...args).split('\n');
        lines[1] = lines[1].replace(/:?-+:?/g, (m) => `${m.startsWith(':') ? ':' : ''}---${m.length > 1 && m.endsWith(':') ? ':' : ''}`);
        return lines.join('\n');
      },
    },
  });
}

/**
 * Stringify a copy of `tree` in which some nodes are replaced by their exact source text:
 * directives that are unknown or invalid (always: build renders those literally), top-level
 * blocks whose choice is SOURCE (from `orig`), and — in RAW blocks — every text node and bare
 * autolink (so prose escapes stay as the author wrote them).
 */
function serialize(tree, orig, src, choices) {
  const copy = structuredClone(tree);
  markVerbatim(copy, src);
  copy.children = copy.children.map((block, i) => {
    // Trailing blank lines (an unclosed container in a list runs over them) would add to the join's.
    if (choices[i] === SOURCE) return { type: 'fmtRaw', value: slice(orig.children[i], src, 0).replace(/(\n[ \t]*)+$/, '') };
    const raw = choices[i] === RAW;
    const holder = { type: 'root', children: [block] };
    walk(holder, (node, parent, index) => {
      if (!node.position) return;
      let value;
      let span;
      // An unclosed container's slice runs over trailing blank lines: drop them (F15).
      if (node.fmtVerbatim) {
        value = slice(node, src, node.position.start.column - 1).replace(/(\n[ \t>]*)+$/, '');
        span = [node.position.start.offset, node.position.start.offset + value.length];
      }
      else if (raw && node.type === 'text' && !(parent.type === 'heading' && node.value.includes('\n'))) value = slice(node, src);
      else if (raw && node.type === 'link' && isAutolink(node, src)) value = slice(node, src);
      // mdast keeps only the alt's plain text (`![a *b*](x)` → alt "a b"): write the source (F16).
      else if (raw && (node.type === 'image' || node.type === 'imageReference')) value = slice(node, src);
      if (value === undefined) return;
      parent.children[index] = span ? { type: 'fmtRaw', value, span } : { type: 'fmtRaw', value };
      return 'skip';
    });
    return holder.children[0];
  });
  return stringifier(src).stringify(copy);
}

/**
 * Flag directives that must be written as-is: unknown or invalid (F2), duplicate attributes, an
 * unclosed container, or a container whose fence is not longer than a nested one's (the inner
 * closing fence closed it: `:::cards` holding `:::card`). A container holding one is flagged too.
 */
function markVerbatim(tree, src) {
  const visit = (node, parent) => {
    let nestedVerbatimContainer = false;
    let innerFence = 0;
    for (const child of node.children || []) {
      const r = visit(child, node);
      if (r.verbatim) nestedVerbatimContainer = true;
      innerFence = Math.max(innerFence, r.fence);
    }
    if (!DIRECTIVE_TYPES.has(node.type) || !node.position) return { verbatim: nestedVerbatimContainer, fence: innerFence };
    const text = src.slice(node.position.start.offset, node.position.end.offset);
    const fence = node.type === 'containerDirective' ? /^:*/.exec(text)[0].length : 0;
    const d = entryFor(node);
    node.fmtVerbatim = !d
      || attrProblems(node, d).length > 0
      || hasDuplicateAttrs(text, node)
      || (d.parent && !(parent.type === 'containerDirective' && parent.name === d.parent))
      || (Array.isArray(d.children) && !node.children.every((c) => c.type === 'containerDirective' && d.children.includes(c.name)))
      || (node.type === 'containerDirective' && (nestedVerbatimContainer || fence <= innerFence || !isClosed(text, fence)));
    return { verbatim: nestedVerbatimContainer || (node.fmtVerbatim && node.type === 'containerDirective'), fence: Math.max(fence, innerFence) };
  };
  visit(tree, null);
}

/** Same test as lint's directive-closed (L7): the last line is only colons, at least `fence` of them. */
function isClosed(text, fence) {
  const last = /^[\s>]*(:+)\s*$/.exec(text.replace(/\n+$/, '').split('\n').pop());
  return text.includes('\n') && Boolean(last) && last[1].length >= fence;
}

/** A key written twice in the `{…}` source (mdast keeps only the last). Conservative: may over-report. */
function hasDuplicateAttrs(text, node) {
  const line = node.type === 'textDirective' ? text : text.split('\n')[0];
  const i = line.indexOf('{', /^:*/.exec(line)[0].length + node.name.length);
  if (i < 0) return false;
  const keys = line.slice(i + 1).replace(/"[^"]*"|'[^']*'/g, '""').replace(/\s*=\s*/g, '=')
    .split(/[\s{}]+/).filter((t) => t && !/^[#.]/.test(t)).map((t) => t.split('=')[0]);
  return new Set(keys).size < keys.length;
}

/** `https://x` (GFM literal) or `<https://x>`: keep the form the author chose. */
function isAutolink(node, src) {
  const s = src.slice(node.position.start.offset, node.position.end.offset);
  const text = node.children.length === 1 && node.children[0].type === 'text' && node.children[0].value;
  return text !== false && (s === text || s === `<${text}>`);
}

/**
 * Source text of a node without the container prefixes (`> `, list indent) of its continuation
 * lines; the enclosing handlers re-add their own. `maxPrefix` limits how much is stripped.
 */
function slice(node, src, maxPrefix) {
  const prefix = maxPrefix === undefined ? /^[ \t>]*/ : new RegExp(`^[ \\t>]{0,${maxPrefix}}`);
  return src.slice(node.position.start.offset, node.position.end.offset)
    .split('\n').map((line, i) => (i === 0 ? line : line.replace(prefix, ''))).join('\n');
}

// ---------------------------------------------------------------- helpers

/** Pre-order walk; `fn` may replace `parent.children[index]` and return 'skip'. */
function walk(node, fn) {
  const children = node.children || [];
  for (let i = 0; i < children.length; i++) {
    if (fn(children[i], node, i) === 'skip') continue;
    walk(children[i], fn);
  }
}

function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) if (k !== 'position' && k !== 'fmtVerbatim') out[k] = strip(v);
  return out;
}

function sameTree(a, b) {
  return isDeepStrictEqual(strip(a), strip(b));
}
