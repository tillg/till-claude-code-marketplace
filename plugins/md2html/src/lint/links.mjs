// Relative links and images must point at existing files; `#fragment`s must name a heading id
// of the target report (or of this report for a bare `#x`), with the ids build assigns. A
// `.html` link whose sibling `.md` exists is a link to that report's build output. Script and
// data URLs are errors. Links in the frontmatter `subtitle` (inline Markdown) are checked too.
// Footnote ids (`user-content-fn-x`, `user-content-fnref-x`, `footnote-label`) are targets too.
// A `.html` whose `.md` would be a report (config `sources`) but is gone is an orphan.
import path from 'node:path';
import { lintRule } from 'unified-lint-rule';
import { visit } from 'unist-util-visit';
import { parseDocument, isMap, isScalar } from 'yaml';
import { unified } from 'unified';
import remarkRehype from 'remark-rehype';
import { suggest } from '../util.mjs';
import { parse } from '../processor.mjs';
import { matchesAny } from '../glob.mjs';
import { headingIds } from '../transforms/headings.mjs';
import { fsAccess, reportPath, relativeTarget } from './fs.mjs';

/** The unsafe scheme of `url` (`javascript:` …), or null. Images may use `data:`. */
function unsafeScheme(url, isImage) {
  // Browsers ignore whitespace and control characters inside a scheme.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(String(url ?? '').replace(/[\u0000- ]/g, ''))?.[1].toLowerCase();
  return ['javascript', 'vbscript', ...(isImage ? [] : ['data'])].includes(scheme) ? `${scheme}:` : null;
}

/** The subtitle's inline Markdown and the position of its first character, or null. */
function subtitleOf(tree) {
  const yaml = tree.children.find((n) => n.type === 'yaml');
  if (!yaml) return null;
  const doc = parseDocument(yaml.value, { schema: 'core', logLevel: 'error' });
  if (doc.errors.length || !isMap(doc.contents)) return null;
  const pair = doc.contents.items.find((p) => isScalar(p.key) && p.key.value === 'subtitle');
  if (!isScalar(pair?.value) || typeof pair.value.value !== 'string' || !pair.value.range) return null;
  const offset = pair.value.range[0] + (pair.value.type === 'PLAIN' ? 0 : 1);
  const before = yaml.value.slice(0, offset);
  return {
    text: pair.value.value,
    line: yaml.position.start.line + 1 + (before.match(/\n/g)?.length ?? 0),
    column: offset - before.lastIndexOf('\n'),
  };
}

const toHast = unified().use(remarkRehype);

/** Every `#fragment` target of a report: heading ids as build assigns them, plus footnote ids. */
export function targetIds(source) {
  const ids = [...headingIds(source)];
  const tree = parse(source);
  let footnotes = false;
  visit(tree, 'footnoteReference', () => { footnotes = true; return false; });
  if (footnotes) {
    // The ids remark-rehype writes (clobber prefix, repeated refs `-2` …, the section label).
    visit(toHast.runSync(tree), 'element', (node) => {
      const id = node.properties?.id;
      if (typeof id === 'string' && (id === 'footnote-label' || id.startsWith('user-content-fn'))) ids.push(id);
    });
  }
  return ids;
}

export const links = lintRule('md2html:links', (tree, file, options = {}) => {
  const { exists, readFile } = { ...fsAccess(), ...options };
  const here = reportPath(options, file);
  // Target ids by root-relative path; `options.cache` (a Map) may be shared across lint calls.
  const idCache = options.cache ?? new Map();
  let ownIds;
  const idsOf = (target) => {
    if (target === '') return (ownIds ??= targetIds(String(file.value)));
    if (!idCache.has(target)) {
      const text = readFile(target);
      idCache.set(target, text === null ? null : targetIds(text));
    }
    return idCache.get(target);
  };
  const check = (node, place) => {
    const unsafe = unsafeScheme(node.url, node.type === 'image');
    if (unsafe) { file.message(`unsafe URL scheme "${unsafe}"`, place); return; }
    const t = relativeTarget(node.url);
    if (!t) return;
    let key = '';
    if (t.path) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(here.split(path.sep).join('/')), t.path));
      const report = /\.html$/i.test(target) && target.replace(/\.html$/i, '.md');
      if (report && exists(report)) key = report;
      else if (report && options.config?.sources && matchesAny(report, options.config.sources)) {
        file.message(`"${t.path}" is generated from "${t.path.replace(/\.html$/i, '.md')}", which does not exist`, place);
        return;
      }
      else if (!exists(target)) { file.message(`link target "${t.path}" does not exist`, place); return; }
      else if (/\.md$/i.test(target)) key = target;
      else return;
    }
    if (!t.fragment) return;
    const ids = idsOf(key);
    if (!ids || ids.includes(t.fragment)) return;
    const near = suggest(t.fragment, ids);
    const where = key ? `"${t.path}"` : 'this report';
    file.message(`"#${t.fragment}" not found in ${where}${near ? `. Did you mean "#${near}"?` : ''}`, place);
  };
  const sub = subtitleOf(tree);
  if (sub) {
    visit(parse(sub.text), ['link', 'image', 'definition'], (node) => {
      check(node, { line: sub.line, column: sub.column + node.position.start.offset });
    });
  }
  visit(tree, ['link', 'image', 'definition'], (node) => check(node, node));
});
