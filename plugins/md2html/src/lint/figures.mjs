// Images need alt text (it becomes the caption); a `.svg` diagram should have its Mermaid
// source next to it. Two plugins so one rule id carries both an error and a warning.
import path from 'node:path';
import { lintRule } from 'unified-lint-rule';
import { visit } from 'unist-util-visit';
import { fsAccess, reportPath, relativeTarget } from './fs.mjs';

export const figureAlt = lintRule('md2html:figure', (tree, file) => {
  visit(tree, ['image', 'imageReference'], (node) => {
    if (!node.alt || !node.alt.trim()) {
      file.message(`image "${node.url ?? node.label}" has no alt text; it is the figure caption`, node);
    }
  });
});

export const figureSource = lintRule('md2html:figure', (tree, file, options = {}) => {
  const { exists } = { ...fsAccess(), ...options };
  const here = reportPath(options, file).split(path.sep).join('/');
  visit(tree, 'image', (node) => {
    const t = relativeTarget(node.url);
    if (!t || !/\.svg$/i.test(t.path)) return;
    const mmd = t.path.replace(/\.svg$/i, '.mmd');
    const resolve = (p) => path.posix.normalize(path.posix.join(path.posix.dirname(here), p));
    if (exists(resolve(t.path)) && !exists(resolve(mmd))) {
      file.message(`"${t.path}" has no sibling "${mmd}" (its Mermaid source)`, node);
    }
  });
});
