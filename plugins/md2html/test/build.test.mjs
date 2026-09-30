import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../src/build.mjs';
import { headingIds } from '../src/transforms/headings.mjs';
import { dir, config, cases, buildCase } from './build-fixtures.mjs';

test('fixtures exist', () => assert.ok(cases.length >= 13));

for (const file of cases) {
  test(`golden: ${file}`, () => {
    const expected = fs.readFileSync(path.join(dir, file.replace(/\.md$/, '.html')), 'utf8');
    assert.equal(buildCase(file), expected);
  });
}

const opts = { file: 'specs/x-report.md', root: '/r', config };

test('theme CSS goes into @layer theme, after base', () => {
  const out = build('---\ntitle: T\n---\n', { ...opts, themeCss: ':root { --accent: red; }\n' });
  assert.match(out, /@layer base, theme;\n@layer base \{\n[\s\S]*\n\}\n@layer theme \{\n:root \{ --accent: red; \}\n\}\n<\/style>/);
});

test('hrefs are relative to the report directory', () => {
  const out = build('---\ntitle: T\n---\n', opts);
  assert.match(out, /<img src="\.\.\/assets\/icon\.svg" alt="">/);
  assert.match(out, /<a class="item" href="\.\.\/minimal-report\.html">/);
});

test('bad frontmatter does not crash the build', () => {
  const out = build('---\ntitle: [unclosed\n---\n\nBody.\n', opts);
  assert.match(out, /<title>x-report<\/title>/);
  assert.match(out, /<p>Body\.<\/p>/);
});

test('ISO dates stay as written', () => {
  const out = build('---\ntitle: T\ncreated: 2026-09-27\nedited: 2026-9-3\n---\n', opts);
  assert.match(out, /<dd>2026-09-27<\/dd>.*<dd>2026-9-3<\/dd>/);
});

test('CRLF input gives the same output as LF', () => {
  const lf = '---\ntitle: T\n---\n\n## A\n\ntext\n';
  assert.equal(build(lf.replace(/\n/g, '\r\n'), opts), build(lf, opts));
});

test('headingIds matches the ids build emits', () => {
  const src = fs.readFileSync(path.join(dir, 'heading-ids-report.md'), 'utf8');
  const emitted = [...buildCase('heading-ids-report.md').matchAll(/<h[1-6] id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...headingIds(src)], emitted);
});
