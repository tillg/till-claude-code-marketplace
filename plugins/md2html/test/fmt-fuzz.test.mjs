// Combinatorial fmt check: directives in list items / blockquotes, closed and unclosed, callouts with
// trailing whitespace, CRLF. Every combination must be idempotent, keep its tree (callouts aside),
// and build to the same HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { format } from '../src/fmt.mjs';
import { parse } from '../src/processor.mjs';
import { build } from '../src/build.mjs';
import { validateConfig } from '../src/config.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'build');
const opts = { file: 'x.md', root, config: validateConfig({ reports: [] }), themeCss: '', exists: () => false };

const blocks = [
  ':::tldr\n*a*  b\n:::',
  ':::tldr\n*a*',
  ':::tldr{x=1}\nbody',
  '::::cards\n:::card{title="A"}\nx\n:::\n::::',
  '::::cards\n:::card{title="A"}\nx\n:::',
  ':::cards\n:::card{title="A"}\nx\n:::\n:::',
  ':::cards\n:::card{title="A"}\nx\n:::\n:::card{title="B"}\ny\n:::\n:::',
  'A :verdict[ok]{tone=go} and :verdict[x]{tone="go" tone="no"}.',
  '> [!tldr]\t\n> tab',
  '> [!tldr]  \n> spaces',
  '> [!TLDR] Title\n> body',
  '> [!tldr]\n>\n> para',
  '> q',
  '![a *b*](x.png)',
  'At 16:00 on :443.',
  '## H {#h}',
];
const wrappers = [
  (b) => b,
  (b) => b.split('\n').map((l, i) => (i ? `  ${l}` : `- ${l}`)).join('\n'),
  (b) => b.split('\n').map((l) => `> ${l}`).join('\n'),
  (b) => b.split('\n').map((l, i) => (i ? `   ${l}` : `1. ${l}`)).join('\n'),
];
const endings = [(s) => s, (s) => `${s}\n`, (s) => `${s}\n\n`];
const eols = [(s) => s, (s) => s.replace(/\n/g, '\r\n')];

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

function* inputs() {
  for (const a of blocks) for (const wa of wrappers) for (const b of [...blocks, '']) {
    for (const end of endings) for (const eol of eols) {
      const body = b ? `${wa(a)}\n\n${b}` : wa(a);
      yield eol(end(body));
    }
  }
}

test('fmt fuzz: idempotent, same tree (callouts aside), same build', () => {
  let n = 0;
  const failures = [];
  for (const src of inputs()) {
    n++;
    let once;
    try {
      once = format(src);
      // Canonical form ends in exactly one newline (F7); blank lines before EOF can change the
      // tree and HTML (`- :::tldr\n  x\n\n` makes the item spread, a loose list), so compare
      // against the input with that ending.
      const eof = src.replace(/\r\n?/g, '\n').replace(/\n+$/, '') + '\n';
      if (format(once) !== once) failures.push(['not idempotent', src]);
      else if (!/\[!tldr\]/i.test(src) && !isDeepStrictEqual(shape(once), shape(eof))) failures.push(['tree changed', src]);
      if (build(once, opts) !== build(eof, opts)) failures.push(['build differs', src]);
    } catch (e) {
      failures.push([`throws ${e.message}`, src]);
    }
  }
  assert.ok(n > 1000, `${n} inputs`);
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} of ${n} failed`);
});
