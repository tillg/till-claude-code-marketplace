// Remark preset for a project's `.remarkrc.mjs` (vscode-remark, remark-cli): the same syntax
// plugins as processor.mjs, every lint rule, and `md2html fmt` as the compiler, so format-on-save
// writes exactly what `md2html fmt` does. Rules that touch files read them relative to `file.path`.
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import { format } from './fmt.mjs';
import { RULES } from './lint.mjs';

/** Compile by formatting the file's source (the tree is only linted, never changed). */
function fmtCompiler() {
  this.compiler = (_tree, file) => format(String(file.value));
}

export const preset = {
  plugins: [
    remarkParse,
    [remarkGfm, { tablePipeAlign: false }],
    [remarkFrontmatter, ['yaml']],
    remarkDirective,
    fmtCompiler,
    ...RULES.map((r) => [r.plugin, [r.severity]]),
  ],
};

export default preset;
