// Plain-Markdown constructs the format handles specially: raw HTML (escaped) and `> [!tldr]` callouts (an alias).
import { lintRule } from 'unified-lint-rule';
import { visit } from 'unist-util-visit';

export const noRawHtml = lintRule('md2html:no-raw-html', (tree, file) => {
  visit(tree, 'html', (node) => {
    file.message('raw HTML is not rendered; it shows as escaped text', node);
  });
});

export const CALLOUT = /^\[!tldr\](?![-+])/i; // fold markers ([!tldr]-) are left alone by fmt and build

export const calloutAlias = lintRule('md2html:callout-alias', (tree, file) => {
  visit(tree, 'blockquote', (node) => {
    const first = node.children[0]?.type === 'paragraph' && node.children[0].children[0];
    if (first?.type === 'text' && CALLOUT.test(first.value)) {
      file.message(`"> ${CALLOUT.exec(first.value)[0]}" found. Use ":::tldr" (fmt converts it)`, node);
    }
  });
});
