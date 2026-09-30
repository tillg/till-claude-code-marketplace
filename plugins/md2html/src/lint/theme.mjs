// theme-tokens: a theme may set only the contract's custom properties (domain.md).
import { suggest } from '../util.mjs';

export const CONTRACT_TOKENS = [
  '--bg', '--fg', '--muted', '--line', '--card', '--accent', '--go', '--go-bg',
  '--partial', '--partial-bg', '--no', '--no-bg', '--code', '--figure-bg',
];

/** Warnings for custom properties defined in `css` that are not contract tokens. */
export function themeTokens(css) {
  // Blank out comments and strings, keeping offsets and newlines.
  const text = css.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (m) => m.replace(/[^\n]/g, ' '));
  const messages = [];
  for (const m of text.matchAll(/(^|[{;\s])(--[\w-]+)\s*:/g)) {
    const name = m[2];
    if (CONTRACT_TOKENS.includes(name)) continue;
    const offset = m.index + m[1].length;
    const before = text.slice(0, offset);
    const line = (before.match(/\n/g)?.length ?? 0) + 1;
    const column = offset - before.lastIndexOf('\n');
    const near = suggest(name, CONTRACT_TOKENS);
    const hint = near ? ` Did you mean "${near}"?` : ' Themes may set only the contract tokens';
    messages.push({ line, column, severity: 'warning', message: `custom property "${name}" is not in the token contract.${hint}`, ruleId: 'theme-tokens' });
  }
  return messages;
}
