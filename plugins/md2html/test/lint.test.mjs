import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { lint, lintTheme, formatMessages, toMessages } from '../src/lint.mjs';
import { preset } from '../src/preset.mjs';

const dir = new URL('./fixtures/lint/', import.meta.url).pathname;
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
const cases = fs.readdirSync(dir).filter((f) => f.endsWith('.expected.txt')).map((f) => f.replace('.expected.txt', '')).sort();
const lintCase = (name) => lint(read(`${name}.md`), { file: `${name}.md`, root: dir });

for (const name of cases.filter((n) => n !== 'theme-tokens')) {
  test(`lint fixture ${name}`, () => {
    const text = formatMessages(lintCase(name), `${name}.md`);
    assert.equal(text ? `${text}\n` : '', read(`${name}.expected.txt`));
  });
}

test('theme-tokens fixture', () => {
  assert.equal(`${formatMessages(lintTheme(read('theme-tokens.css')), 'theme-tokens.css')}\n`, read('theme-tokens.expected.txt'));
});

test('contract-only theme is clean', () => {
  assert.deepEqual(lintTheme(':root { --bg: #fff; --accent: red }\n@media (prefers-color-scheme: dark) { :root { --bg: #000 } }\n'), []);
});

test('clean report yields no messages', () => {
  assert.deepEqual(lintCase('clean'), []);
});

test('JSON format snapshot', () => {
  assert.equal(`${formatMessages(lintCase('links'), 'links.md', { format: 'json' })}\n`, read('links.expected.json'));
});

test('messages are sorted by line, column, rule id', () => {
  const m = lintCase('directive-known');
  const sorted = [...m].sort((a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
  assert.deepEqual(m, sorted);
});

test('readFile/exists callbacks replace the filesystem', () => {
  const source = `${read('clean.md')}\n[x](elsewhere.md#there)\n`;
  const seen = [];
  const m = lint(source, {
    file: 'specs/a-report.md',
    exists: (rel) => { seen.push(rel); return true; },
    readFile: (rel) => (rel === 'specs/elsewhere.md' ? '## Not here\n' : '## Context {#ctx}\n'),
  });
  assert.ok(seen.includes('specs/elsewhere.md'));
  assert.deepEqual(m.map((x) => x.message), ['"#there" not found in "elsewhere.md"']);
});

test('CRLF input lints like LF', () => {
  assert.deepEqual(lint(read('directive-attrs.md').replace(/\n/g, '\r\n'), { file: 'directive-attrs.md', root: dir }), lintCase('directive-attrs'));
});

test('preset: unified().use(preset) yields the same messages', async () => {
  for (const name of cases.filter((n) => n !== 'theme-tokens')) {
    const file = new VFile({ path: path.join(dir, `${name}.md`), value: read(`${name}.md`) });
    await unified().use(preset).process(file);
    assert.deepEqual(toMessages(file.messages), lintCase(name), name);
  }
});

test('preset stringifies with the canonical settings', async () => {
  const out = String(await unified().use(preset).process('* a\n* b\n\n| a | b |\n|---|:-:|\n| long cell | x |\n'));
  assert.equal(out, '- a\n- b\n\n| a | b |\n| --- | :---: |\n| long cell | x |\n');
});

test('fragments use the ids build assigns (prose colons, explicit ids first, duplicates)', () => {
  const source = `${read('clean.md')}\n## Meet at 16:00\n\n## Findings\n\n[a](#meet-at-1600) [b](#findings-1) [c](#context)\n`;
  assert.deepEqual(lint(source, { file: 'clean.md', root: dir }), []);
});

test('a shared cache gives identical messages and parses each target once', () => {
  const reads = [];
  const readFile = (rel) => { reads.push(rel); try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return null; } };
  const names = ['links', 'links-html', 'links-unsafe', 'clean'];
  const cache = new Map();
  for (const name of names) {
    const opts = { file: `${name}.md`, root: dir, readFile };
    const alone = lint(read(`${name}.md`), opts);
    assert.deepEqual(lint(read(`${name}.md`), { ...opts, cache }), alone, name);
  }
  reads.length = 0;
  for (const name of names) lint(read(`${name}.md`), { file: `${name}.md`, root: dir, readFile, cache });
  assert.deepEqual(reads, [], 'a warm cache reads no target again');
  assert.ok(cache.has('links-target.md'));
});

test('orphaned .html: the report it was built from is gone', () => {
  const source = read('links-orphan.md');
  const config = { sources: ['*-report.md'] };
  const messages = (opts) => formatMessages(lint(source, { file: 'links-orphan.md', root: dir, ...opts }), 'links-orphan.md');
  assert.equal(messages({ config }), [
    'links-orphan.md:8:8  error  "stale-report.html" is generated from "stale-report.md", which does not exist  [links]',
    'links-orphan.md:8:38  error  "gone-report.html" is generated from "gone-report.md", which does not exist  [links]',
    'links-orphan.md:8:64  error  link target "notes.html" does not exist  [links]',
  ].join('\n'));
  // Without a config nothing says which .html files are reports: the stale file just exists.
  assert.equal(messages({}), [
    'links-orphan.md:8:38  error  link target "gone-report.html" does not exist  [links]',
    'links-orphan.md:8:64  error  link target "notes.html" does not exist  [links]',
  ].join('\n'));
});

test('footnote fragments lint accepts are ids in the built HTML', async () => {
  const { build } = await import('../src/build.mjs');
  const { validateConfig } = await import('../src/config.mjs');
  const source = read('footnotes.md').replace(' {#footnote-label}', '');
  const html = build(source, { file: 'footnotes.md', root: dir, config: validateConfig({}) });
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const id of ['user-content-fn-1', 'user-content-fnref-1', 'user-content-fnref-1-2', 'user-content-fn-note', 'footnote-label']) {
    assert.ok(ids.has(id), id);
  }
  assert.deepEqual(lint(source, { file: 'footnotes.md', root: dir }).map((m) => m.message), ['"#user-content-fn-missing" not found in this report']);
});

test('BOM input lints like without', () => {
  for (const name of ['directive-attrs', 'frontmatter-values', 'links']) {
    assert.deepEqual(lint(`﻿${read(`${name}.md`)}`, { file: `${name}.md`, root: dir }), lintCase(name), name);
  }
});

test('YAML problems print nothing to stderr', () => {
  const script = `
    import { lint } from ${JSON.stringify(new URL('../src/lint.mjs', import.meta.url).href)};
    const fm = (extra) => '---\\ntitle: x\\ncreated: 2026-09-01\\nedited: 2026-09-01\\nstatus: research\\n' + extra + '\\n---\\n';
    for (const extra of ['subtitle: !foo x', '%FOO', 'subtitle:\\n  ? [a]\\n  : b', 'subtitle: *Draft*', 'description: *nope']) lint(fm(extra), { file: 'a.md' });
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
});
