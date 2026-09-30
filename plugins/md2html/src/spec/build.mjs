// buildSpec: spec Markdown → one HTML page with the group's inner navigation. Pure: no fs, clock or env.
// Same parse chain as reports, but no section numbering, no hoisted TL;DR, no report header.
import path from 'node:path';
import { parse, normalizeInput } from '../processor.mjs';
import { toHast, stringify } from '../build.mjs';
import { baseCss, specCss, version } from '../assets.mjs';
import { esc, safeCss } from '../render.mjs';
import { relHref, encodePath } from '../util.mjs';
import { extractFrontmatter, fmString } from '../transforms/frontmatter.mjs';
import { literalizeInvalid } from '../transforms/directives.mjs';
import { assignHeadingIds } from '../transforms/headings.mjs';
import { figures } from '../transforms/figures.mjs';
import { tables } from '../transforms/tables.mjs';
import { links, dropUnsafeUrls } from '../transforms/links.mjs';
import { calloutsToTldr } from '../transforms/callouts.mjs';

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const toHtml = (file) => file.replace(/\.md$/, '.html');

/** Mutates hast `tree`: every `<pre><code class="language-mermaid">` becomes `<pre class="mermaid">` (source as text). Returns the count. */
export function mermaidBlocks(tree) {
  let count = 0;
  const walk = (parent) => {
    if (!parent.children) return;
    parent.children = parent.children.map((node) => {
      const code = node.type === 'element' && node.tagName === 'pre' && node.children.length === 1 ? node.children[0] : null;
      if (code?.tagName === 'code' && code.properties.className?.includes('language-mermaid')) {
        count++;
        const text = code.children.map((c) => c.value ?? '').join('').replace(/\n$/, '');
        return { type: 'element', tagName: 'pre', properties: { className: ['mermaid'] }, children: [{ type: 'text', value: text }] };
      }
      walk(node);
      return node;
    });
  };
  walk(tree);
  return count;
}

/** `<nav class="spec-nav">`: up link to the project index, one link per group item, status pill. */
export function renderSpecNav({ file, config, group, status }) {
  const up = `<a class="up" href="${esc(encodePath(relHref(file, config.specs.index)))}">↑ Index</a>`;
  const items = (group?.items ?? []).map((it) => {
    const current = it.file === file ? ' aria-current="page"' : '';
    return `<a class="item" href="${esc(encodePath(relHref(file, toHtml(it.file))))}"${current}>${esc(it.label)}</a>`;
  });
  const pill = status ? `<span class="spec-status ${esc(status)}">${esc(capitalise(status))}</span>` : '';
  return `<nav class="spec-nav" aria-label="Spec pages">${up}${items.join('')}${pill}</nav>`;
}

// Import from a JS string literal: JSON quoting, and `<` escaped so the URL can't end the <script> early.
const jsString = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

export function mermaidScript(url) {
  return [
    '<script type="module">',
    `import mermaid from ${jsString(url)};`,
    "mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });",
    "await mermaid.run({ querySelector: 'pre.mermaid' });",
    '</script>',
  ].join('\n');
}

/** The page shell shared by spec pages and the project index. `nav`, `body`, `script` are HTML ('' when absent). */
export function specPage({ config, title, nav, body, script = '', themeCss = '' }) {
  const theme = normalizeInput(themeCss);
  const lines = [
    '<!doctype html>',
    `<html lang="${esc(config.lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="generator" content="md2html ${esc(version)}">`,
    '<style>',
    '@layer base, theme;',
    '@layer base {',
    safeCss(baseCss).trimEnd(),
    safeCss(specCss).trim(),
    '}',
    '@layer theme {',
    theme.trim() ? safeCss(theme).trimEnd() : null,
    '}',
    '</style>',
    '</head>',
    '<body>',
    nav || null,
    '<main>',
    body.trim() || null,
    '</main>',
    script || null,
    '</body>',
    '</html>',
  ];
  return lines.filter((l) => l !== null).join('\n') + '\n';
}

/**
 * `file`: the spec path relative to the root (posix); `group`: its group from groups.mjs (undefined → up link only).
 * Title: frontmatter `title`, else the first `# ` heading, else the file name. An `<h1>` is added only when the body has none.
 */
export function buildSpec(source, { file, config, group, themeCss = '' }) {
  const src = normalizeInput(source);
  const tree = parse(src);
  const { data } = extractFrontmatter(tree);
  calloutsToTldr(tree);
  literalizeInvalid(tree, src);
  const headings = assignHeadingIds(tree);
  const h1 = headings.find((h) => h.depth === 1);
  const title = fmString(data, 'title') ?? h1?.text ?? path.posix.basename(file).replace(/\.md$/, '');

  const hast = toHast.runSync(tree);
  dropUnsafeUrls(hast);
  figures(hast, { file, exists: () => false });
  tables(hast);
  links(hast, { file, sources: [...config.specs.sources, ...config.sources] });
  const diagrams = mermaidBlocks(hast);

  const body = (h1 ? '' : `<h1>${esc(title)}</h1>\n`) + stringify(hast.children);
  return specPage({
    config, title, themeCss, body,
    nav: renderSpecNav({ file, config, group, status: fmString(data, 'status') }),
    script: diagrams ? mermaidScript(config.specs.mermaid) : '',
  });
}
