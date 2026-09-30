// Validate directives against the registry. Unknown or invalid ones, and raw HTML, become
// literal text holding their exact source, so no content is ever lost.
import { entryFor, attrProblems } from '../registry.mjs';

const FLOW_PARENTS = new Set(['root', 'blockquote', 'listItem', 'containerDirective', 'footnoteDefinition']);
const DIRECTIVE = new Set(['containerDirective', 'leafDirective', 'textDirective']);

// What each ancestor puts in front of a continuation line: `>` for a blockquote, the content indent
// for a list item (or footnote). Lazy lines without the prefix are left alone.
function prefixPatterns(ancestors) {
  return ancestors.flatMap((a) => {
    if (a.type === 'blockquote') return [/^[ \t]{0,3}>[ \t]?/];
    if (a.type === 'listItem' && a.children[0]) return [new RegExp(`^ {0,${a.children[0].position.start.column - a.position.start.column}}`)];
    if (a.type === 'footnoteDefinition') return [/^ {0,4}/];
    return [];
  });
}

/** The node's source as the author wrote it inside its containers; trailing blank lines dropped. */
function sourceText(node, ancestors, source) {
  const patterns = prefixPatterns(ancestors);
  const [first, ...rest] = source.slice(node.position.start.offset, node.position.end.offset).split('\n');
  const lines = rest.map((line) => patterns.reduce((l, re) => l.replace(re, ''), line));
  return [first, ...lines].join('\n').replace(/[ \t\n]+$/, '');
}

function literal(node, ancestors, source) {
  const parent = ancestors[ancestors.length - 1];
  const value = node.type === 'html' ? node.value : sourceText(node, ancestors, source);
  const text = { type: 'text', value, position: node.position };
  return FLOW_PARENTS.has(parent.type) ? { type: 'paragraph', children: [text], position: node.position } : text;
}

/** Whether a directive node renders (known name + form, valid attrs, allowed parent). */
export function isValidDirective(node, parent) {
  const d = entryFor(node);
  if (!d || attrProblems(node, d).length) return false;
  if (d.parent && !(parent.type === 'containerDirective' && parent.name === d.parent)) return false;
  return true;
}

/** Mutates `tree`; `source` is the normalized text the tree was parsed from. */
export function literalizeInvalid(tree, source) {
  const walk = (ancestors) => {
    const parent = ancestors[ancestors.length - 1];
    if (!parent.children) return;
    const allowed = parent.type === 'containerDirective' && Array.isArray(entryFor(parent)?.children) ? entryFor(parent).children : null;
    parent.children = parent.children.map((node) => {
      if (node.type === 'html') return literal(node, ancestors, source);
      if (allowed && !(node.type === 'containerDirective' && allowed.includes(node.name))) return literal(node, ancestors, source);
      if (DIRECTIVE.has(node.type) && !isValidDirective(node, parent)) return literal(node, ancestors, source);
      walk([...ancestors, node]);
      return node;
    });
  };
  walk([tree]);
  return tree;
}
