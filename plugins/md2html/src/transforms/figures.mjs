// An image alone in a paragraph becomes a <figure> with its alt text as caption and, when a
// sibling `.mmd` exists, a link to that diagram source.
import path from 'node:path';
import { resolveRelative } from './links.mjs';

const isBlank = (n) => n.type === 'text' && /^\s*$/.test(n.value);

function mmdHref(src, file, exists) {
  const [pathPart] = src.split(/[?#]/);
  const ext = path.posix.extname(pathPart);
  if (!ext || ext === '.mmd') return undefined;
  const candidate = pathPart.slice(0, -ext.length) + '.mmd';
  const resolved = resolveRelative(file, candidate);
  return resolved && exists(resolved) ? candidate : undefined;
}

/** Mutates hast `tree`. `file` is the report path relative to the root. */
export function figures(tree, { file, exists }) {
  const walk = (parent) => {
    if (!parent.children) return;
    parent.children = parent.children.map((node) => {
      if (node.type === 'element' && node.tagName === 'p') {
        const content = node.children.filter((c) => !isBlank(c));
        if (content.length === 1 && content[0].type === 'element' && content[0].tagName === 'img') return figure(content[0], file, exists);
      }
      walk(node);
      return node;
    });
  };
  walk(tree);
  return tree;
}

function figure(img, file, exists) {
  const alt = img.properties.alt || '';
  const href = typeof img.properties.src === 'string' ? mmdHref(img.properties.src, file, exists) : undefined;
  const caption = [];
  if (alt) caption.push({ type: 'text', value: alt });
  if (href) {
    const link = { type: 'element', tagName: 'a', properties: { className: ['mmd-src'], href }, children: [{ type: 'text', value: 'source' }] };
    caption.push(...(alt ? [{ type: 'text', value: ' (' }, link, { type: 'text', value: ')' }] : [link]));
  }
  const children = [img];
  if (caption.length) children.push({ type: 'element', tagName: 'figcaption', properties: {}, children: caption });
  return { type: 'element', tagName: 'figure', properties: {}, children };
}
