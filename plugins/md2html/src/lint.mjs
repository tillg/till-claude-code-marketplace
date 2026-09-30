// lint: run the rules in src/lint/ over one report and format the messages.
import { VFile } from 'vfile';
import { parser, normalizeInput } from './processor.mjs';
import { directiveKnown, directiveClosed, directiveAttrs, directiveNesting } from './lint/directives.mjs';
import { frontmatter } from './lint/frontmatter.mjs';
import { links } from './lint/links.mjs';
import { figureAlt, figureSource } from './lint/figures.mjs';
import { headingNumber, headingId } from './lint/headings.mjs';
import { noRawHtml, calloutAlias } from './lint/markdown.mjs';
import { themeTokens } from './lint/theme.mjs';
import { fsAccess } from './lint/fs.mjs';

/** Every rule with its severity; `files: true` rules take `{file, config, cache, exists, readFile}`. */
export const RULES = [
  { plugin: directiveKnown, severity: 'error' },
  { plugin: directiveClosed, severity: 'error' },
  { plugin: directiveAttrs, severity: 'error' },
  { plugin: directiveNesting, severity: 'error' },
  { plugin: frontmatter, severity: 'error' },
  { plugin: headingId, severity: 'error' },
  { plugin: headingNumber, severity: 'warn' },
  { plugin: links, severity: 'error', files: true },
  { plugin: figureAlt, severity: 'error' },
  { plugin: figureSource, severity: 'warn', files: true },
  { plugin: noRawHtml, severity: 'warn' },
  { plugin: calloutAlias, severity: 'warn' },
];

const order = (a, b) => a.line - b.line || a.column - b.column || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0);

/** vfile messages → our Message shape, sorted. */
export function toMessages(vfileMessages) {
  return vfileMessages.map((m) => ({
    line: m.line ?? 1, column: m.column ?? 1,
    severity: m.fatal ? 'error' : 'warning',
    message: m.reason, ruleId: m.ruleId,
  })).sort(order);
}

/**
 * Lint one report. `file` is root-relative (posix). `readFile(rel)` → string | null and
 * `exists(rel)` → boolean default to the filesystem under `root`. `cache` is a Map (root-relative
 * `.md` path → its fragment ids, or null when unreadable) that callers linting many reports of one
 * root can share, so each link target is parsed once; default: a new Map per call. `config`
 * (`sources`) lets `links` flag `.html` links whose report `.md` is gone.
 */
export function lint(source, { file = '', root = '.', config, readFile, exists, cache } = {}) {
  const access = { ...fsAccess(root), ...(readFile && { readFile }), ...(exists && { exists }) };
  const processor = parser();
  for (const r of RULES) processor.use(r.plugin, [r.severity, r.files ? { file, config, cache, ...access } : undefined]);
  const vfile = new VFile({ path: file || undefined, value: normalizeInput(source) });
  processor.runSync(processor.parse(vfile), vfile);
  return toMessages(vfile.messages);
}

/** Lint a theme stylesheet (custom properties outside the contract). */
export function lintTheme(cssText) {
  return themeTokens(normalizeInput(cssText)).sort(order);
}

/** `path:line:col  severity  message  [rule-id]` lines, or a JSON array with a `file` field. */
export function formatMessages(messages, displayPath, { format = 'text' } = {}) {
  if (format === 'json') {
    return JSON.stringify(messages.map((m) => ({ file: displayPath, line: m.line, column: m.column, severity: m.severity, message: m.message, ruleId: m.ruleId })), null, 2);
  }
  return messages.map((m) => `${displayPath}:${m.line}:${m.column}  ${m.severity}  ${m.message}  [${m.ruleId}]`).join('\n');
}

