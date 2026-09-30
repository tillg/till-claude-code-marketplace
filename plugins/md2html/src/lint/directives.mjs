// Directive rules: known names, closed fences, attributes, nesting. All driven by the registry.
import { lintRule } from 'unified-lint-rule';
import { visit } from 'unist-util-visit';
import { directives, byName, entryFor, attrProblems, FORM_OF_TYPE, PREFIX } from '../registry.mjs';
import { suggest } from '../util.mjs';

const DIRECTIVE_TYPES = ['containerDirective', 'leafDirective', 'textDirective'];
const isDirective = (node) => DIRECTIVE_TYPES.includes(node.type);
const slice = (node, file) => String(file.value).slice(node.position.start.offset, node.position.end.offset);

/** Canonical display of a registry entry: `:verdict`, `:::card`, `::::cards` (holds containers). */
export function display(d) {
  const colons = d.form === 'container' && Array.isArray(d.children) ? '::::' : PREFIX[d.form];
  return `${colons}${d.name}`;
}

/** Display of a node as written: its own leading colons plus the name. */
function written(node, file) {
  const colons = /^:+/.exec(slice(node, file))?.[0] ?? PREFIX[FORM_OF_TYPE[node.type]];
  return `${colons}${node.name}`;
}

/** D1: an inline directive with no `[label]` and no `{attrs}` is prose (`16:00`, `:443`, `a:b`). */
function isProse(node, file) {
  return node.type === 'textDirective' && !/^:[^\s[{]*[[{]/.test(slice(node, file));
}

/** P3: `:::cards` (short fence) holding a `:::card`; the card's `:::` closes the cards. */
function isShortCards(node, file) {
  const d = node?.type === 'containerDirective' && entryFor(node);
  return Boolean(d && Array.isArray(d.children) && /^:+/.exec(slice(node, file))[0].length < 4
    && node.children.some((c) => c.type === 'containerDirective' && d.children.includes(c.name)));
}

/** Source of a directive's `{…}` block (first line for containers/leaves), or ''. */
function attrSource(node, file) {
  const text = slice(node, file);
  let i = /^:+/.exec(text)[0].length + node.name.length;
  if (text[i] === '[') {
    for (let depth = 0; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '[') depth++;
      else if (text[i] === ']' && --depth === 0) { i++; break; }
    }
  }
  if (text[i] !== '{') return '';
  const m = /^\{(?:"[^"]*"|'[^']*'|[^}"'])*\}/.exec(text.slice(i));
  return m ? m[0] : '';
}

/** Keys that appear more than once in the `{…}` source (mdast keeps only the last). */
function duplicateKeys(attrs) {
  const keys = attrs.slice(1, -1).replace(/"[^"]*"|'[^']*'/g, '""').replace(/\s*=\s*/g, '=')
    .split(/\s+/).filter((t) => t && !/^[#.]/.test(t)).map((t) => t.split('=')[0]);
  return [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
}

export const directiveKnown = lintRule('md2html:directive-known', (tree, file) => {
  visit(tree, (node) => {
    if (!isDirective(node) || entryFor(node) || isProse(node, file)) return;
    // M3: `10:30[^1]`, `3:1[x]` — a time or ratio followed by a label swallows it.
    if (node.type === 'textDirective' && /^\d/.test(node.name)) {
      const text = slice(node, file);
      const before = /[\w.]*$/.exec(String(file.value).slice(0, node.position.start.offset))[0];
      const shown = `${written(node, file)}${text[text.indexOf(node.name) + node.name.length] === '[' ? '[…]' : '{…}'}`;
      file.message(`"${shown}" is read as a directive; write "${before}\\${text}" (escape the colon) to keep the time or ratio`, node);
      return;
    }
    const near = byName.get(node.name) ? node.name : suggest(node.name, directives.map((d) => d.name));
    const hint = near ? `. Did you mean "${display(byName.get(near))}"?` : '';
    file.message(`unknown directive "${written(node, file)}"${hint}`, node);
  });
});

export const directiveClosed = lintRule('md2html:directive-closed', (tree, file) => {
  const source = String(file.value);
  const lastLine = source.replace(/\n$/, '').split('\n').length;
  visit(tree, 'containerDirective', (node, _index, parent) => {
    if (isShortCards(parent, file)) return; // directive-nesting explains it
    const text = slice(node, file);
    const open = /^:+/.exec(text)[0].length;
    const last = text.replace(/\n+$/, '').split('\n').pop();
    const fence = /^[\s>]*(:+)\s*$/.exec(last);
    const closed = text.includes('\n') && fence && fence[1].length >= open;
    if (!closed) file.message(`"${written(node, file)}" opened here is never closed (file ends at line ${lastLine})`, node.position.start);
  });
});

export const directiveAttrs = lintRule('md2html:directive-attrs', (tree, file) => {
  visit(tree, (node) => {
    const d = isDirective(node) && entryFor(node);
    if (!d) return;
    const name = display(d);
    const keys = Object.keys(d.attrs);
    if (d.form === 'container' && node.children[0]?.data?.directiveLabel) file.message(`"${name}" takes no [label]`, node);
    for (const key of duplicateKeys(attrSource(node, file))) file.message(`"${name}" has duplicate attribute "${key}"`, node);
    for (const p of attrProblems(node, d)) {
      if (p.kind === 'bad-value') {
        file.message(`"${name}" ${p.key}="${p.value}" is not allowed. Use ${p.allowed.join(' | ')}`, node);
      } else if (p.kind === 'missing-attr') {
        const use = p.allowed ? `. Use ${p.allowed.join(' | ')}` : '';
        file.message(`"${name}" needs ${p.key}="…"${use}`, node);
      } else if (p.kind === 'unknown-attr') {
        if (!keys.length) { file.message(`"${name}" takes no attributes, found "${p.key}"`, node); continue; }
        const near = suggest(p.key, keys);
        const hint = near ? ` Did you mean "${near}"?` : ` Allowed: ${keys.join(', ')}`;
        file.message(`"${name}" has unknown attribute "${p.key}".${hint}`, node);
      }
    }
  });
});

export const directiveNesting = lintRule('md2html:directive-nesting', (tree, file) => {
  visit(tree, (node, index, parent) => {
    const d = isDirective(node) && entryFor(node);
    if (isShortCards(node, file)) {
      file.message(`"${display(d)}" needs four colons when it holds cards (found "${written(node, file)}")`, node);
      return;
    }
    // Cards after a short-fenced cards spilled out of it; the message above covers them.
    if (d?.parent && parent.children.slice(0, index).some((s) => isShortCards(s, file))) return;
    if (d?.parent && !(parent && isDirective(parent) && parent.name === d.parent && entryFor(parent))) {
      file.message(`"${display(d)}" must be inside "${display(byName.get(d.parent))}"`, node);
    }
    if (d && Array.isArray(d.children)) {
      const allowed = d.children.map((n) => `"${display(byName.get(n))}"`).join(', ');
      for (const child of node.children) {
        if (isDirective(child) && d.children.includes(child.name) && entryFor(child)) continue;
        file.message(`"${display(d)}" may only contain ${allowed}`, child);
      }
    }
  });
});
