// build: report Markdown → one self-contained HTML page. Pure: no fs, clock or env.
import path from 'node:path';
import { unified } from 'unified';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { toString } from 'mdast-util-to-string';
import { parse, normalizeInput } from './processor.mjs';
import { entryFor } from './registry.mjs';
import { baseCss, version } from './assets.mjs';
import { extractFrontmatter, fmString } from './transforms/frontmatter.mjs';
import { literalizeInvalid } from './transforms/directives.mjs';
import { assignHeadingIds } from './transforms/headings.mjs';
import { numberSections, hoistTldr, TOC_MIN_SECTIONS } from './transforms/toc.mjs';
import { figures } from './transforms/figures.mjs';
import { tables } from './transforms/tables.mjs';
import { links, dropUnsafeUrls } from './transforms/links.mjs';
import { calloutsToTldr } from './transforms/callouts.mjs';
import { renderPage } from './render.mjs';

const h = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });

function directiveHandler(state, node) {
  // Only valid directives reach this point (literalizeInvalid ran first).
  const ctx = { children: (n) => (n.type === 'textDirective' ? state.all(n) : state.wrap(state.all(n), true)) };
  const result = entryFor(node).render(node, h, ctx);
  state.patch(node, result);
  return result;
}

const toHast = unified().use(remarkRehype, {
  handlers: { containerDirective: directiveHandler, textDirective: directiveHandler, leafDirective: directiveHandler },
});
const html = unified().use(rehypeStringify);
const stringify = (children) => html.stringify({ type: 'root', children });

/** mdast root → hast root with the hast-level layout rules applied (`figures: false` for the subtitle). */
function render(tree, { file, config, exists }, { figures: withFigures = true } = {}) {
  const hast = toHast.runSync(tree);
  dropUnsafeUrls(hast);
  if (withFigures) figures(hast, { file, exists });
  tables(hast);
  links(hast, { file, sources: config.sources });
  return hast;
}

/** Subtitle (inline Markdown) → { html, text }. */
function renderSubtitle(subtitle, opts) {
  const src = normalizeInput(subtitle).trim();
  const tree = literalizeInvalid(parse(src), src);
  const para = tree.children.length === 1 && tree.children[0].type === 'paragraph'
    ? tree.children[0]
    : { type: 'paragraph', children: [{ type: 'text', value: src }] };
  const hast = render({ type: 'root', children: [para] }, opts, { figures: false });
  return { html: stringify(hast.children[0].children), text: toString(para) };
}

/** `file` is the report path relative to `root` (posix); `exists(rootRelPath)` answers `.mmd` lookups. */
export function build(source, { file, root, config, themeCss = '', exists = () => false }) {
  void root; // every path the page contains is relative to the report, so root is not needed here
  const src = normalizeInput(source);
  const tree = parse(src);
  const { data } = extractFrontmatter(tree);
  calloutsToTldr(tree);
  literalizeInvalid(tree, src);
  const headings = assignHeadingIds(tree);
  const toc = numberSections(headings);
  const hasTldr = hoistTldr(tree);
  const opts = { file, config, exists };
  const hast = render(tree, opts);

  let tldrHtml = '';
  if (hasTldr) {
    const i = hast.children.findIndex((n) => n.type === 'element');
    tldrHtml = stringify(hast.children.splice(i, 1));
  }
  const subtitle = fmString(data, 'subtitle');
  const sub = subtitle?.trim() ? renderSubtitle(subtitle, opts) : null;
  const title = fmString(data, 'title') ?? path.posix.basename(file).replace(/\.md$/, '');
  const description = fmString(data, 'description') ?? sub?.text;

  return renderPage({
    file, config, title, description,
    created: fmString(data, 'created'), edited: fmString(data, 'edited'), status: fmString(data, 'status'),
    subtitleHtml: sub?.html ?? '', tldrHtml,
    toc: toc.length >= TOC_MIN_SECTIONS ? toc : [],
    bodyHtml: stringify(hast.children),
    baseCss, themeCss: normalizeInput(themeCss), version,
  });
}
