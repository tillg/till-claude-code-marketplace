// The one parse chain shared by fmt, lint and build.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';

export const STRINGIFY_OPTIONS = {
  bullet: '-', emphasis: '*', strong: '*', fence: '`', fences: true, rule: '-',
  listItemIndent: 'one', incrementListMarker: true, tightDefinitions: true, quote: '"',
};

/** Strip a UTF-8 BOM, CRLF → LF, NFC. */
export function normalizeInput(source) {
  return source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC');
}

export function parser() {
  return unified().use(remarkParse).use(remarkGfm, { tablePipeAlign: false }).use(remarkFrontmatter, ['yaml']).use(remarkDirective);
}

/** Parse normalized source into mdast. */
export function parse(source) {
  return parser().parse(normalizeInput(source));
}
