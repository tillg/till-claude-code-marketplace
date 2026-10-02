import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildSpec } from '../src/spec/build.mjs';
import { buildIndex } from '../src/spec/index.mjs';
import { validateConfig } from '../src/config.mjs';
import { version } from '../src/assets.mjs';
import { dir, config, specFiles, buildCase, buildIndexCase, expectedPath } from './spec-fixtures.mjs';

test('spec fixtures exist', () => assert.equal(specFiles.length, 8));

for (const file of specFiles) {
  test(`golden: ${file}`, () => assert.equal(buildCase(file), fs.readFileSync(expectedPath(file), 'utf8')));
}
test('golden: index.html', () => assert.equal(buildIndexCase(), fs.readFileSync(path.join(dir, 'index.html'), 'utf8')));

const file = 'specs/changes/x/plan.md';
const group = { dir: 'specs/changes/x', items: [
  { file: 'specs/changes/x/proposal.md', label: 'Proposal' },
  { file, label: 'Plan' },
] };
const opts = { file, config, group };
const count = (s, re) => (s.match(re) || []).length;

test('generator meta, same inlined @layer CSS, theme last', () => {
  const out = buildSpec('# T\n', { ...opts, themeCss: ':root { --accent: red; }\n' });
  assert.ok(out.includes(`<meta name="generator" content="md2html ${version}">`));
  assert.match(out, /@layer base, theme;\n@layer base \{\n[\s\S]*\.spec-nav[\s\S]*\n\}\n@layer theme \{\n:root \{ --accent: red; \}\n\}\n<\/style>/);
});

test('nav: up link, one link per item with aria-current on this page, status pill', () => {
  const out = buildSpec('---\nstatus: applying\n---\n# T\n', opts);
  assert.ok(out.includes('<nav class="spec-nav" aria-label="Spec pages"><a class="up" href="../../../index.html">↑ Index</a>'
    + '<a class="item" href="proposal.html">Proposal</a><a class="item" href="plan.html" aria-current="page">Plan</a>'
    + '<span class="spec-status applying">Applying</span></nav>'));
});

test('nav: no status → no pill; no group → up link only; index path from config', () => {
  const cfg = validateConfig({ specs: { index: 'specs/index.html' } });
  const out = buildSpec('# T\n', { file, config: cfg });
  assert.ok(out.includes('<nav class="spec-nav" aria-label="Spec pages"><a class="up" href="../../index.html">↑ Index</a></nav>'));
  assert.doesNotMatch(out.split('</style>')[1], /spec-status/);
});

test('no section numbering, no TL;DR hoisting, no report header', () => {
  const out = buildSpec('# T\n\n## A\n\n## B\n\n## C\n\n## D\n\n:::tldr\nshort\n:::\n', opts);
  assert.match(out, /<h2 id="a">A<\/h2>\n<h2 id="b">B<\/h2>\n<h2 id="c">C<\/h2>\n<h2 id="d">D<\/h2>\n<div class="tldr">/);
  assert.doesNotMatch(out.split('</style>')[1], /class="toc"|class="top"|report-meta|reports-nav/);
});

test('title: frontmatter, else first # heading, else file name; <h1> added only when the body has none', () => {
  assert.match(buildSpec('---\ntitle: FM\n---\n# Body\n', opts), /<title>FM<\/title>[\s\S]*<main>\n<h1 id="body">Body<\/h1>/);
  assert.match(buildSpec('Intro.\n\n# Body *x*\n', opts), /<title>Body x<\/title>[\s\S]*<main>\n<p>Intro/);
  const noH1 = buildSpec('---\ntitle: A & B\n---\n## Sec\n', opts);
  assert.match(noH1, /<title>A &amp; B<\/title>[\s\S]*<main>\n<h1>A &amp; B<\/h1>\n<h2 id="sec">/);
  assert.match(buildSpec('Text only.\n', opts), /<title>plan<\/title>[\s\S]*<main>\n<h1>plan<\/h1>/);
});

test('mermaid fences → <pre class="mermaid"> with escaped source; other code unchanged', () => {
  const out = buildSpec('# T\n\n```mermaid\ngraph LR\n  A["<b>x</b>"] --> B\n```\n\n```js\nx\n```\n', opts);
  assert.ok(out.includes('<pre class="mermaid">graph LR\n  A["&#x3C;b>x&#x3C;/b>"] --> B</pre>'));
  assert.ok(out.includes('<pre><code class="language-js">x\n</code></pre>'));
});

test('module script only when there is a mermaid block, exactly once', () => {
  assert.doesNotMatch(buildSpec('# T\n\n```js\nx\n```\n', opts), /<script/);
  const out = buildSpec('# T\n\n```mermaid\ngraph LR\nA-->B\n```\n\n```mermaid\ngraph TD\nC-->D\n```\n', opts);
  assert.equal(count(out, /<script/g), 1);
  assert.equal(count(out, /<pre class="mermaid">/g), 2);
  assert.ok(out.includes(`<script type="module">\nimport mermaid from ${JSON.stringify(config.specs.mermaid)};\n`
    + "mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });\n"
    + "await mermaid.run({ querySelector: 'pre.mermaid' });\n</script>\n</body>"));
});

test('a mermaid URL cannot end the script element', () => {
  const cfg = validateConfig({ specs: { mermaid: 'https://x.test/a</script><b>.mjs' } });
  const out = buildSpec('```mermaid\ngraph LR\nA-->B\n```\n', { file, config: cfg });
  assert.equal(count(out, /<\/script>/g), 1);
  assert.ok(out.includes('import mermaid from "https://x.test/a\\u003c/script>\\u003cb>.mjs";'));
});

test('links: .md → .html for spec and report targets only', () => {
  const cfg = validateConfig({ sources: ['reports/*.md'], specs: {} });
  const out = buildSpec('[a](proposal.md) [b](../../../reports/r.md#x) [c](../../../README.md) [d](https://e.test/a.md)\n', { file, config: cfg });
  assert.ok(out.includes('<a href="proposal.html">a</a> <a href="../../../reports/r.html#x">b</a> <a href="../../../README.md">c</a> <a href="https://e.test/a.md">d</a>'));
});

test('raw HTML and unknown directives stay literal text; unsafe URLs dropped', () => {
  const out = buildSpec('# T\n\n<script>alert(1)</script>\n\n:::nope\nx\n:::\n\n[bad](javascript:alert(1))\n', opts);
  assert.doesNotMatch(out, /<script>alert/);
  assert.ok(out.includes('&#x3C;script>alert(1)&#x3C;/script>'));
  assert.ok(out.includes('<p>:::nope\nx\n:::</p>'));
  assert.ok(out.includes('<p>bad</p>'));
});

test('bad frontmatter does not crash; CRLF equals LF', () => {
  assert.match(buildSpec('---\ntitle: [unclosed\n---\n\nBody.\n', opts), /<title>plan<\/title>/);
  const lf = '---\ntitle: T\nstatus: applying\n---\n\n# T\n\n```mermaid\ngraph LR\nA-->B\n```\n';
  assert.equal(buildSpec(lf.replace(/\n/g, '\r\n'), opts), buildSpec(lf, opts));
});

test('index: hrefs relative to its location, dashes for missing values, no scripts', () => {
  const cfg = validateConfig({ specs: { index: 'specs/index.html' } });
  const all = [{ dir: 'specs/system', items: [{ file: 'specs/system/a.md', label: 'A', title: 'Alpha', feature: null, status: null, edited: null }] }];
  const out = buildIndex(all, { config: cfg });
  assert.ok(out.includes('<tr><td class="dir" data-label="Directory"><code>specs/system/</code></td><td data-label="Feature">—</td><td data-label="Status">—</td><td data-label="Title"><a href="system/a.html">Alpha</a></td><td class="num" data-label="Edited">—</td><td class="pages" data-label="Pages"><a href="system/a.html">A</a></td></tr>'));
  assert.doesNotMatch(out, /<script/);
  assert.ok(out.includes(`<meta name="generator" content="md2html ${version}">`));
});

test('index: feature links to the group\'s first page', () => {
  const items = [
    { file: 'specs/f/proposal.md', label: 'Proposal', title: 'P', feature: 'f', status: 'proposed', edited: null },
    { file: 'specs/f/plan.md', label: 'Plan', title: 'Q', feature: 'f', status: 'proposed', edited: null },
  ];
  assert.ok(buildIndex([{ dir: 'specs/f', items }], { config }).includes('<td data-label="Feature"><a href="specs/f/proposal.html">f</a></td>'));
});

test('index: newest edited wins; empty project says so', () => {
  const items = ['2026-09-02', null, '2026-10-01', '2026-01-31'].map((edited, i) => ({ file: `d/${i}.md`, label: String(i), title: 'T', feature: 'd', status: 'proposed', edited }));
  assert.match(buildIndex([{ dir: 'd', items }], { config }), /<td class="num" data-label="Edited">2026-10-01<\/td>/);
  assert.match(buildIndex([], { config }), /<p>No spec files yet\.<\/p>/);
});
