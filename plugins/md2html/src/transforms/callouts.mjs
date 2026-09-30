// `> [!tldr]` (any case, first line of a blockquote, no fold marker) renders exactly like the
// `:::tldr` that fmt turns it into: the marker goes, an optional title stays as the first line.
import { visit } from 'unist-util-visit';

const CALLOUT = /^\[!tldr\](?![-+])[^\S\n]*\n?/i;

/** Mutates mdast `tree`: every tldr callout blockquote becomes a `tldr` containerDirective. */
export function calloutsToTldr(tree) {
  visit(tree, 'blockquote', (node, index, parent) => {
    const para = node.children[0];
    const text = para?.type === 'paragraph' && para.children[0];
    if (!text || text.type !== 'text') return;
    const m = CALLOUT.exec(text.value);
    if (!m) return;
    text.value = text.value.slice(m[0].length);
    if (text.value === '') para.children.shift();
    if (para.children.length === 0) node.children.shift();
    parent.children[index] = { type: 'containerDirective', name: 'tldr', attributes: {}, children: node.children, position: node.position };
  });
  return tree;
}
