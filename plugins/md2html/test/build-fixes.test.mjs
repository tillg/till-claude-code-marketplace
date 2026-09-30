// Build behaviours fixed after the pilot: callout alias, pure hrefs, unsafe URLs, theme
// normalisation, menu fragments, subtitle images, token-driven pills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../src/build.mjs';
import { format } from '../src/fmt.mjs';
import { relHref } from '../src/util.mjs';
import { baseCss } from '../src/assets.mjs';
import { dir, config, exists } from './build-fixtures.mjs';

const opts = { file: 'specs/x-report.md', root: '/r', config };
const body = (html) => html.slice(html.indexOf('<main>'), html.indexOf('</main>'));

// ---------------------------------------------------------------- `> [!tldr]` renders as :::tldr

const fmtDir = path.join(dir, '..', 'fmt');
for (const file of fs.readdirSync(fmtDir).filter((f) => f.startsWith('callout-') && f.endsWith('.in.md')).sort()) {
  test(`callout: build(x) === build(format(x)): fmt/${file}`, () => {
    const source = fs.readFileSync(path.join(fmtDir, file), 'utf8');
    const o = { file, root: dir, config, exists };
    assert.equal(build(source, o), build(format(source), o));
  });
}

test('callout: `> [!tldr]` becomes the hoisted tldr, in any case', () => {
  for (const marker of ['[!tldr]', '[!TLDR]', '[!TlDr]']) {
    const out = build(`---\ntitle: T\n---\n\nIntro.\n\n> ${marker}\n> Short.\n`, opts);
    assert.match(body(out), /<\/header>\n<div class="tldr">\n?<p>Short\.<\/p>\n?<\/div>\n<p>Intro\.<\/p>/);
    assert.doesNotMatch(body(out), /blockquote/);
  }
});

test('callout: fold markers, other callouts and non-first lines stay blockquotes', () => {
  for (const src of ['> [!tldr]- Folded\n> x\n', '> [!tldr]+ Open\n> x\n', '> [!note]\n> x\n', '> Intro\n> [!tldr]\n']) {
    const out = build(`---\ntitle: T\n---\n\n${src}`, opts);
    assert.match(out, /<blockquote>/, src);
    assert.doesNotMatch(out, /class="tldr"/, src);
  }
});

test('callout: only the first tldr is hoisted; a later callout stays in place', () => {
  const out = body(build('---\ntitle: T\n---\n\n:::tldr\nOne.\n:::\n\nMiddle.\n\n> [!tldr]\n> Two.\n', opts));
  assert.match(out, /<div class="tldr">\n?<p>One\.<\/p>\n?<\/div>\n<p>Middle\.<\/p>\n<div class="tldr">\n?<p>Two\.<\/p>/);
});

// ---------------------------------------------------------------- relHref is pure

test('relHref: URLs, //host and /root pass through unchanged', () => {
  for (const url of ['https://github.com/x', 'http://e.com/a.svg', 'mailto:a@b.c', 'data:image/png;base64,AA', '//cdn.e.com/i.svg', '/abs/x.html']) {
    assert.equal(relHref('specs/a-report.md', url), url);
  }
});

test('relHref: relative paths stay relative to the report directory', () => {
  assert.equal(relHref('specs/a-report.md', 'assets/i.svg'), '../assets/i.svg');
  assert.equal(relHref('a-report.md', 'a-report.html'), 'a-report.html');
  assert.equal(relHref('specs/a-report.md', 'specs/a-report.html'), 'a-report.html');
});

test('nav: URL and absolute entries are emitted as written', () => {
  const cfg = { ...config, brand: { name: 'B', icon: 'https://e.com/i.svg' }, reports: [{ path: 'https://github.com/x', label: 'GH' }, { path: '/abs/y-report.md', label: 'Abs' }] };
  const out = build('---\ntitle: T\n---\n', { ...opts, config: cfg });
  assert.match(out, /<span class="brand"><img src="https:\/\/e\.com\/i\.svg" alt="">B<\/span>/);
  assert.match(out, /<a class="item" href="https:\/\/github\.com\/x">GH<\/a>/);
  assert.match(out, /<a class="item" href="\/abs\/y-report\.md">Abs<\/a>/);
  assert.match(out, /<img class="appicon" src="https:\/\/e\.com\/i\.svg"/);
});

// ---------------------------------------------------------------- unsafe URL schemes

test('unsafe link hrefs are dropped; the text stays', () => {
  const src = '---\ntitle: T\n---\n\n[a](javascript:alert(1)) [b](JavaScript:x) [c](vbscript:x) [d](data:text/html,x) [e](https://ok.example)\n\n[f][r]\n\n[r]: javascript:y\n';
  const out = body(build(src, opts));
  assert.match(out, /<p>a b c d <a href="https:\/\/ok\.example">e<\/a><\/p>/);
  assert.match(out, /<p>f<\/p>/);
  assert.doesNotMatch(out, /javascript|vbscript|data:/i);
});

test('unsafe hrefs in the subtitle are dropped too', () => {
  const out = build('---\ntitle: T\nsubtitle: "see [x](javascript:alert(1))"\n---\n', opts);
  assert.match(out, /<p class="sub">see x<\/p>/);
  assert.doesNotMatch(out, /javascript/i);
});

test('unsafe image srcs render as their alt text', () => {
  const out = body(build('---\ntitle: T\n---\n\nInline ![pic](javascript:x) here.\n\n![alone](vbscript:x)\n\n![ok](data:image/png;base64,AA)\n', opts));
  assert.match(out, /<p>Inline pic here\.<\/p>/);
  assert.match(out, /<p>alone<\/p>/);
  assert.match(out, /<img src="data:image\/png;base64,AA" alt="ok">/);
  assert.doesNotMatch(out, /javascript|vbscript/i);
});

// ---------------------------------------------------------------- theme CSS normalisation

test('theme CSS: CRLF and NFD give the same page as LF and NFC', () => {
  const nfc = ':root { --accent: red; }\n/* café */\n.x { content: "é"; }\n';
  const nfd = nfc.normalize('NFD').replace(/\n/g, '\r\n');
  assert.notEqual(nfd, nfc);
  const src = '---\ntitle: T\n---\n';
  assert.equal(build(src, { ...opts, themeCss: nfd }), build(src, { ...opts, themeCss: nfc }));
});

// ---------------------------------------------------------------- menu #fragment

test('nav: a #fragment is kept and ignored for aria-current', () => {
  const cfg = { ...config, reports: [{ path: 'specs/x-report.md#top', label: 'Here' }, { path: 'specs/y-report.md#s', label: 'Other' }] };
  const out = build('---\ntitle: T\n---\n', { ...opts, config: cfg });
  assert.match(out, /<a class="item" href="x-report\.html#top" aria-current="page">Here<\/a>/);
  assert.match(out, /<a class="item" href="y-report\.html#s">Other<\/a>/);
});

// ---------------------------------------------------------------- subtitle images

test('an image-only subtitle is a plain inline image, not a figure', () => {
  const out = build('---\ntitle: T\nsubtitle: "![logo](i.svg)"\n---\n', opts);
  assert.match(out, /<p class="sub"><img src="i\.svg" alt="logo"><\/p>/);
  assert.doesNotMatch(body(out), /figcaption|<figure/);
});

// ---------------------------------------------------------------- CSS contract

const rule = (sel) => {
  const i = baseCss.indexOf(`${sel} {`);
  assert.ok(i >= 0, `rule ${sel} missing`);
  return baseCss.slice(i, baseCss.indexOf('}', i));
};

test('css: status pills and the current nav item use contract tokens only', () => {
  const statusRules = baseCss.split('\n').filter((l) => l.includes('report-status') || l.includes('aria-current'));
  for (const l of statusRules) assert.doesNotMatch(l, /#[0-9a-f]{3,8}\b|rgba?\(/i, l);
  assert.match(rule('.report-status.research'), /color: var\(--accent\)/);
  assert.match(rule('.report-status.ongoing'), /color: var\(--partial\); background: var\(--partial-bg\)/);
  assert.match(rule('.report-status.implemented'), /color: var\(--go\); background: var\(--go-bg\)/);
  assert.match(rule('.reports-nav a.item[aria-current="page"]'), /color: var\(--bg\)/);
});

test('css: right-aligned cells are nowrap with tabular numbers', () => {
  assert.match(rule('th[align="right"], td[align="right"]'), /white-space: nowrap; font-variant-numeric: tabular-nums/);
});
