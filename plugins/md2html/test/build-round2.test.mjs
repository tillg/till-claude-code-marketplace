// Build fixes, round 2: literal directives inside containers, trailing newlines, BOM,
// YAML warnings/aliases, subtitle image size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from '../src/build.mjs';
import { baseCss } from '../src/assets.mjs';
import { config } from './build-fixtures.mjs';

const opts = { file: 'specs/x-report.md', root: '/r', config };
const body = (html) => html.slice(html.indexOf('</header>') + '</header>'.length, html.indexOf('</main>')).trim();
const fm = '---\ntitle: T\n---\n\n';

// ---------------------------------------------------------------- literal text without container prefixes

test('literal: an invalid container in a blockquote drops the `> ` prefixes', () => {
  assert.equal(body(build(`${fm}> :::tldr{x=1}\n> body\n> :::\n`, opts)),
    '<blockquote>\n<p>:::tldr{x=1}\nbody\n:::</p>\n</blockquote>');
});

test('literal: an unknown container in a list in a blockquote drops both prefixes', () => {
  assert.equal(body(build(`${fm}> - :::unknown\n>   body\n>   :::\n`, opts)),
    '<blockquote>\n<ul>\n<li>:::unknown\nbody\n:::</li>\n</ul>\n</blockquote>');
});

test('literal: nested blockquotes and ordered-list indentation are stripped', () => {
  assert.equal(body(build(`${fm}> > :::unknown\n> > body\n> > :::\n`, opts)),
    '<blockquote>\n<blockquote>\n<p>:::unknown\nbody\n:::</p>\n</blockquote>\n</blockquote>');
  assert.equal(body(build(`${fm}10. a\n\n    :::unknown\n    > body\n    :::\n`, opts)),
    '<ol start="10">\n<li>\n<p>a</p>\n<p>:::unknown\n> body\n:::</p>\n</li>\n</ol>');
});

test('literal: an inline directive spanning blockquote lines drops the prefix', () => {
  assert.equal(body(build(`${fm}> a :x[b\n> c] d\n`, opts)), '<blockquote>\n<p>a :x[b\nc] d</p>\n</blockquote>');
});

test('literal: an unclosed invalid container at EOF does not depend on the final newline', () => {
  for (const tail of ['', '\n', '\n\n\n']) {
    assert.equal(body(build(`${fm}:::tldr{x=1}\nbody${tail}`, opts)), '<p>:::tldr{x=1}\nbody</p>', JSON.stringify(tail));
  }
  assert.equal(build(`${fm}> :::unknown\n> body`, opts), build(`${fm}> :::unknown\n> body\n`, opts));
});

// ---------------------------------------------------------------- UTF-8 BOM

const BOM = '﻿';

test('bom: prose colons keep their text', () => {
  assert.equal(body(build(`${BOM}It is 10:30.\n`, opts)), '<p>It is 10:30.</p>');
  assert.equal(build(`${BOM}${fm}At 16:00, a:b.\n`, opts), build(`${fm}At 16:00, a:b.\n`, opts));
});

test('bom: frontmatter still parses and unknown directives stay literal', () => {
  const src = `${fm}:::unknown\nbody\n:::\n\n::leaf{a=1}\n`;
  assert.equal(build(BOM + src, opts), build(src, opts));
  assert.match(build(BOM + src, opts), /<title>T<\/title>/);
});

test('bom: a theme starting with a BOM keeps its first rule', () => {
  const theme = ':root { --accent: #123456; }\n';
  const out = build(`${fm}x\n`, { ...opts, themeCss: BOM + theme });
  assert.equal(out, build(`${fm}x\n`, { ...opts, themeCss: theme }));
  assert.ok(!out.includes(BOM));
});

// ---------------------------------------------------------------- YAML

test('yaml: an unresolved alias renders as if the frontmatter were invalid', () => {
  const out = build('---\ntitle: T\nsubtitle: *Draft*\n---\n\nx\n', opts);
  assert.equal(out, build('---\n: : :\n---\n\nx\n', opts));
  assert.match(out, /<title>x-report<\/title>/);
});

test('yaml: build writes no YAMLWarning to stderr', () => {
  const buildUrl = new URL('../src/build.mjs', import.meta.url).href;
  const fixturesUrl = new URL('./build-fixtures.mjs', import.meta.url).href;
  const script = `
    const { build } = await import(${JSON.stringify(buildUrl)});
    const { config } = await import(${JSON.stringify(fixturesUrl)});
    const o = { file: 'x-report.md', root: '/r', config };
    for (const y of ['title: !foo T', 'subtitle: *Draft*', '%FOO bar\\n---\\ntitle: T', 'title: !!binary x'])
      build('---\\n' + y + '\\n---\\n\\nx\\n', o);
    await new Promise((r) => setTimeout(r, 50));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: fileURLToPath(new URL('.', import.meta.url)) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
});

// ---------------------------------------------------------------- subtitle image size

test('css: subtitle images are text-height, not full width', () => {
  const rule = /\.sub img\s*\{([^}]*)\}/.exec(baseCss)?.[1] ?? '';
  assert.match(rule, /height:\s*1\.2em/);
  assert.match(rule, /width:\s*auto/);
  assert.match(rule, /vertical-align:\s*middle/);
});
