import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from '../src/fmt.mjs';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { parse } from '../src/processor.mjs';
import { preset } from '../src/preset.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FMT = path.join(FIXTURES, 'fmt');
const BUILD = path.join(FIXTURES, 'build');
const read = (p) => fs.readFileSync(p, 'utf8');
const list = (dir, suffix) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(suffix)).sort() : []);

const cases = list(FMT, '.in.md').map((f) => f.slice(0, -'.in.md'.length));

test('fmt golden fixtures exist', () => assert.ok(cases.length >= 15));

for (const name of cases) {
  test(`fmt golden: ${name}`, () => {
    assert.equal(format(read(path.join(FMT, `${name}.in.md`))), read(path.join(FMT, `${name}.out.md`)));
  });
}

const idempotenceInputs = [
  ...cases.flatMap((n) => [path.join(FMT, `${n}.in.md`), path.join(FMT, `${n}.out.md`)]),
  ...list(BUILD, '.md').map((f) => path.join(BUILD, f)),
];

for (const file of idempotenceInputs) {
  test(`fmt idempotent: ${path.relative(FIXTURES, file)}`, () => {
    const once = format(read(file));
    assert.equal(format(once), once);
  });
}

test('fmt output: LF, NFC, exactly one final newline', () => {
  const out = format('# Café\r\n\r\nText\r\n\r\n\r\n');
  assert.equal(out, '# Café\n\nText\n');
});

test('fmt keeps prose colons byte-exact', () => {
  const src = 'At 16:00 on :443, a:b, 10:30:45 and ::1.\n';
  assert.equal(format(src), src);
});

// ---------------------------------------------------------------- tree invariance (reviewer bugs)

/** mdast without positions; frontmatter compared as data (fmt reorders keys). */
function shape(src) {
  const strip = (node) => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) if (k !== 'position') out[k] = strip(v);
    if (out.type === 'yaml') { try { out.value = YAML.parse(out.value); } catch { /* keep text */ } }
    return out;
  };
  return strip(parse(src));
}
const assertSameTree = (src) => {
  const out = format(src);
  assert.ok(isDeepStrictEqual(shape(out), shape(src)), `tree changed:\n${out}`);
  assert.equal(format(out), out);
  return out;
};

test('fmt never changes the tree: ragged table next to prose (M1)', () => {
  const src = '| a |\n| - |\n| b | c |\n\nSee [x] and 2 * 3.\n';
  const out = assertSameTree(src);
  assert.match(out, /See \[x\] and 2 \* 3\./, 'prose escapes are not touched by a failing table');
});

test('fmt: a thematic break at document start never becomes frontmatter (M2)', () => {
  const out = assertSameTree('***\n\nImportant text here\n\n***\n');
  assert.match(out, /Important text here/);
});

test('fmt keeps GitHub callouts, tildes, emoji shortcodes, entities and bare URLs as written', () => {
  const src = '> [!NOTE]\n> Careful.\n\nAbout ~50-line files :thumbsup: &lt;tag&gt; at https://example.com/x.\n\n| a | b |\n| --- | --- |\n| c |\n';
  const out = assertSameTree(src);
  for (const s of ['> [!NOTE]', '~50-line', ':thumbsup:', '&lt;tag&gt;', ' https://example.com/x.']) assert.ok(out.includes(s), `${s} in\n${out}`);
});

test('fmt leaves folded tldr callouts (`[!tldr]-`, `[!tldr]+`) untouched (F6)', () => {
  for (const marker of ['-', '+']) {
    const src = `> [!tldr]${marker} Folded title\n> Body.\n`;
    assert.equal(format(src), src);
  }
});

test('fmt table delimiter cells are ---, :---, ---:, :---:', () => {
  const out = format('|a|b|c|d|\n|-|:-|-:|:-:|\n|1|2|3|4|\n');
  assert.equal(out, '| a | b | c | d |\n| --- | :--- | ---: | :---: |\n| 1 | 2 | 3 | 4 |\n');
  assert.equal(format('> |a|b|\n> |-|-:|\n'), '> | a | b |\n> | --- | ---: |\n');
});

test('fmt keeps the line structure of multi-line YAML scalars', () => {
  const src = '---\nsubtitle: >-\n  First line\n  second line\ntitle: T\n---\n\nText.\n';
  assert.equal(format(src), src);
  const plain = '---\ndescription: a long\n  plain scalar\ntitle: T\n---\n\nText.\n';
  assert.equal(format(plain), plain);
});

test('fmt: every fixture keeps its tree (callouts excepted)', () => {
  for (const file of [...cases.filter((n) => !n.startsWith('callout-tldr')).map((n) => path.join(FMT, `${n}.in.md`)), ...list(BUILD, '.md').map((f) => path.join(BUILD, f))]) {
    const src = read(file);
    if (/\[!tldr\]/i.test(src)) continue;
    assert.ok(isDeepStrictEqual(shape(format(src)), shape(src)), file);
  }
});

test('preset formats exactly like fmt (M4)', async () => {
  for (const name of cases) {
    const src = read(path.join(FMT, `${name}.in.md`));
    const out = String(await unified().use(preset).process(new VFile({ value: src })));
    assert.equal(out, format(src), name);
  }
});

// ---------------------------------------------------------------- round-2 review bugs

test('fmt never throws on YAML aliases; bad frontmatter stays byte-for-byte (F12)', () => {
  for (const fm of ['subtitle: *Draft*', 'title: *x', 'status: *ongoing', 'title: T\nsubtitle: *a']) {
    const src = `---\n${fm}\n---\n\nText.\n`;
    assert.equal(format(src), src);
  }
});

test('fmt keeps an unclosed container verbatim instead of closing it at EOF (F13)', () => {
  const src = ':::tldr\nShort.\n\n## Findings {#findings}\n\nBody.';
  assert.equal(format(src), `${src}\n`);
  assert.equal(format(':::tldr\n*a*\n'), ':::tldr\n*a*\n');
  const nested = '::::cards\n:::card{title="A"}\nx\n:::\n';
  assert.equal(format(nested), nested);
});

test('fmt keeps directives with duplicate attributes verbatim (F13)', () => {
  for (const src of [
    'A :verdict[x]{tone="go" tone="no"} pill.\n',
    "A :verdict[x]{tone='go' tone=no} pill.\n",
    '::::cards\n:::card{title="a" title="b"}\nx\n:::\n::::\n',
  ]) assert.equal(format(src), src);
});

test('fmt keeps a short-fenced `:::cards` holding cards verbatim (F14)', () => {
  for (const src of [
    ':::cards\n:::card{title="A"}\nx\n:::\n:::\n',
    ':::cards\n:::card{title="A"}\nx\n:::\n:::card{title="B"}\ny\n:::\n:::\n',
    ':::cards\n:::card{title="A"}\nx\n:::\n\n:::card{title="B"}\ny\n:::\n:::\n',
  ]) assert.equal(format(src), src);
});

test('fmt is idempotent on directives in list items and tab-trailed callouts (F15)', () => {
  for (const src of ['- :::tldr\n  x\n\n> q\n', '> [!tldr]\t\n> tab\n', '> [!tldr]  \n> two\n', '- > [!tldr]\t\n  > x\n']) {
    const once = format(src);
    assert.equal(format(once), once, JSON.stringify(src));
  }
  assert.equal(format('> [!tldr]\t\n> tab\n'), ':::tldr\ntab\n:::\n');
});

test('fmt keeps image alt source (F16)', () => {
  for (const src of ['![a *b*](x.png)\n', '![a `c` **d**](x.png "t")\n', '![a *b*][r]\n\n[r]: x.png\n']) assert.equal(format(src), src);
});

test('fmt prints no YAML warnings (F17)', () => {
  const orig = process.emitWarning;
  const seen = [];
  process.emitWarning = (w) => seen.push(String(w?.message ?? w));
  try {
    format('---\n? [a]\n: b\ntitle: T\n---\n\nx\n');
    format('---\ntitle: T\n? {a: 1}\n: c\n---\n\nx\n');
  } finally {
    process.emitWarning = orig;
  }
  assert.deepEqual(seen, []);
});
