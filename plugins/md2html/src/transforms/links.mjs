// Links between reports: a relative `.md` link whose target matches `sources` points at the `.html`.
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { matchesAny } from '../glob.mjs';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Root-relative path of a relative URL path written in report `file`, or undefined (absolute, external, outside root). */
export function resolveRelative(file, urlPath) {
  if (!urlPath || SCHEME.test(urlPath) || urlPath.startsWith('/') || urlPath.startsWith('#')) return undefined;
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { decoded = urlPath; }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded));
  return resolved.startsWith('../') || resolved === '..' ? undefined : resolved;
}

/** The href to emit for `href` written in report `file`. */
export function rewriteHref(href, { file, sources }) {
  const m = /^([^?#]*)(.*)$/s.exec(href);
  const [, pathPart, rest] = m;
  if (!pathPart.endsWith('.md')) return href;
  const resolved = resolveRelative(file, pathPart);
  if (!resolved || !matchesAny(resolved, sources)) return href;
  return pathPart.slice(0, -3) + '.html' + rest;
}

// Schemes that run script (or, for links, render attacker-supplied documents). Browsers ignore
// ASCII whitespace and control characters inside a scheme, so those are removed before testing.
const UNSAFE_HREF = /^(?:javascript|vbscript|data):/i;
const UNSAFE_SRC = /^(?:javascript|vbscript):/i;
const scheme = (url) => url.replace(/[\u0000-\u0020\u007f]/g, '');

/** Mutates hast `tree`: `<a>` with an unsafe href is replaced by its content, `<img>` with an unsafe src by its alt text. */
export function dropUnsafeUrls(tree) {
  const walk = (parent) => {
    if (!parent.children) return;
    parent.children = parent.children.flatMap((node) => {
      if (node.type !== 'element') return [node];
      const { href, src } = node.properties;
      if (node.tagName === 'a' && typeof href === 'string' && UNSAFE_HREF.test(scheme(href))) { walk(node); return node.children; }
      if (node.tagName === 'img' && typeof src === 'string' && UNSAFE_SRC.test(scheme(src))) return node.properties.alt ? [{ type: 'text', value: String(node.properties.alt) }] : [];
      walk(node);
      return [node];
    });
  };
  walk(tree);
  return tree;
}

/** Mutates hast `tree`. */
export function links(tree, { file, sources }) {
  visit(tree, 'element', (node) => {
    if (node.tagName === 'a' && typeof node.properties.href === 'string') node.properties.href = rewriteHref(node.properties.href, { file, sources });
  });
  return tree;
}
