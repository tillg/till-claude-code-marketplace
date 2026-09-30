// Headings: `##` titles must not carry typed section numbers (build adds them), and explicit
// `{#id}`s must be unique within a report and must not take the footnote section's id.
import { lintRule } from 'unified-lint-rule';
import { visit } from 'unist-util-visit';

// Same suffix as src/transforms/headings.mjs (ID_SUFFIX).
const ID_SUFFIX = /[ \t]*\{#([^\s{}]+)\}[ \t]*$/;
// The id remark-rehype gives the footnote section's `<h2>`.
const FOOTNOTE_LABEL = 'footnote-label';
// A section number: 1–2 digit components joined by `.`, then an optional `.`/`)`, then spaces.
const NUMBER = /^(\d{1,2}(?:\.\d{1,2})*)([.)]?)([ \t]*)/;

/**
 * The typed section number at the start of `text`, or null. Flagged: `1. x`, `2) x`, `2.3 x`,
 * `2.3. x` (punctuation or a dotted number, then whitespace), and `1 Intro`, `1.Intro`, `4)Wrap`
 * (otherwise only before an uppercase letter). Never: 3+ digit components (`2024. Review`,
 * `1.234`), versions with a later `0` component (`2.0 Migration`), `3 options`, `3.x`.
 */
function sectionNumber(text, more) {
  const m = NUMBER.exec(text);
  if (!m || /\d/.test(text[m[1].length] ?? '') || /\.0+(?:\.|$)/.test(m[1])) return null;
  const rest = text.slice(m[0].length);
  if (m[3] && (m[2] || m[1].includes('.')) && (rest || more)) return m[0];
  return /^\p{Lu}/u.test(rest) ? m[0] : null;
}

export const headingNumber = lintRule('md2html:heading-number', (tree, file) => {
  visit(tree, 'heading', (node) => {
    const first = node.children[0];
    const number = node.depth === 2 && first?.type === 'text' && sectionNumber(first.value, node.children.length > 1);
    if (number) file.message(`section numbers are added by the build; remove "${number}"`, node);
  });
});

export const headingId = lintRule('md2html:heading-id', (tree, file) => {
  const seen = new Map();
  visit(tree, 'heading', (node) => {
    const last = node.children[node.children.length - 1];
    const id = last?.type === 'text' && ID_SUFFIX.exec(last.value)?.[1];
    if (!id) return;
    if (id === FOOTNOTE_LABEL) file.message(`id "#${id}" is reserved for footnotes`, node);
    else if (seen.has(id)) file.message(`duplicate id "#${id}" (first used at line ${seen.get(id)})`, node);
    else seen.set(id, node.position.start.line);
  });
});
