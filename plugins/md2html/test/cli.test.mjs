import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { main } from '../src/cli.mjs';
import { tempProject, today } from './helpers.mjs';

async function run(argv, cwd) {
  const out = { lines: [], errs: [] };
  const code = await main(argv, { cwd, out: { log: (s) => out.lines.push(s), err: (s) => out.errs.push(s) } });
  return { code, stdout: out.lines.join('\n'), stderr: out.errs.join('\n') };
}

const CONFIG = JSON.stringify({ sources: ['specs/**/*-report.md'], reports: [{ path: 'specs/01/a-report.md', label: 'A' }], brand: { name: 'Test' } });

test('new writes a skeleton that passes fmt --check, lint and build', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  let r = await run(['new', 'specs/01/a-report.md'], root);
  assert.equal(r.code, 0, r.stderr);
  const md = fs.readFileSync(path.join(root, 'specs/01/a-report.md'), 'utf8');
  assert.match(md, new RegExp(`^---\ntitle: A\ncreated: ${today()}\nedited: ${today()}\nstatus: research\n---\n`));
  assert.match(md, /:::tldr/);
  r = await run(['fmt', '--check'], root); assert.equal(r.code, 0, r.stderr);
  r = await run(['lint'], root); assert.equal(r.code, 0, r.stdout);
  r = await run(['build'], root); assert.equal(r.code, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(root, 'specs/01/a-report.html')));
  r = await run(['check'], root); assert.equal(r.code, 0, r.stdout + r.stderr);
});

test('new --title, refuses to overwrite, needs .md', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  assert.equal((await run(['new', 'specs/x-report.md', '--title', 'Hello: world'], root)).code, 0);
  assert.match(fs.readFileSync(path.join(root, 'specs/x-report.md'), 'utf8'), /^---\ntitle: "Hello: world"\n/);
  assert.equal((await run(['new', 'specs/x-report.md'], root)).code, 2);
  assert.equal((await run(['new', 'specs/x.txt'], root)).code, 2);
});

test('fmt rewrites, fmt --check detects, build --check detects stale and missing html', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  await run(['new', 'specs/01/a-report.md'], root);
  const file = path.join(root, 'specs/01/a-report.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- Where', '* Where'));
  assert.equal((await run(['fmt', '--check'], root)).code, 1);
  assert.equal((await run(['check'], root)).code, 1);
  let r = await run(['fmt'], root);
  assert.equal(r.code, 0); assert.match(r.stdout, /formatted specs\/01\/a-report.md/);
  assert.equal((await run(['fmt', '--check'], root)).code, 0);
  assert.equal((await run(['build', '--check'], root)).code, 1, 'missing html is stale');
  assert.equal((await run(['build'], root)).code, 0);
  r = await run(['build'], root);
  assert.equal(r.stdout, '', 'second build writes nothing');
  assert.equal((await run(['build', '--check'], root)).code, 0);
  fs.appendFileSync(file, '\nMore.\n');
  assert.equal((await run(['build', '--check'], root)).code, 1);
});

test('lint reports errors with exit 1, text and json', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  await run(['new', 'specs/01/a-report.md'], root);
  const file = path.join(root, 'specs/01/a-report.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(':::tldr', ':::tdlr'));
  let r = await run(['lint'], root);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /specs\/01\/a-report\.md:\d+:\d+ +error +unknown directive ":::tdlr"\. Did you mean ":::tldr"\?/);
  r = await run(['lint', '--format', 'json'], root);
  assert.equal(r.code, 1);
  const json = JSON.parse(r.stdout);
  assert.equal(json[0].ruleId, 'directive-known');
  r = await run(['lint'], path.join(root, 'specs'));
  assert.match(r.stdout, /^01\/a-report\.md:/m, 'paths are relative to the cwd');
});

test('config errors and usage errors exit 2', async () => {
  const bare = tempProject({ 'x.md': '# x\n' });
  assert.equal((await run(['build'], bare)).code, 2, 'no reports.json');
  const bad = tempProject({ 'reports.json': '{"sorces": []}' });
  const r = await run(['build'], bad);
  assert.equal(r.code, 2); assert.match(r.stderr, /unknown key "sorces"/);
  const broken = tempProject({ 'reports.json': '{' });
  assert.equal((await run(['lint'], broken)).code, 2);
  const root = tempProject({ 'reports.json': CONFIG });
  assert.equal((await run(['frobnicate'], root)).code, 2);
  assert.equal((await run(['build', '--nope'], root)).code, 2);
  assert.equal((await run([], root)).code, 2);
  assert.equal((await run(['lint', 'missing.md'], root)).code, 2);
  const themed = tempProject({ 'reports.json': JSON.stringify({ theme: 'reports/theme.css' }) });
  assert.equal((await run(['build'], themed)).code, 2, 'missing theme file');
});

test('explicit paths outside sources are processed; default is all sources, sorted', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  await run(['new', 'specs/02/b-report.md'], root);
  await run(['new', 'specs/01/a-report.md'], root);
  await run(['new', 'notes/other.md'], root);
  let r = await run(['build'], root);
  assert.deepEqual(r.stdout.split('\n'), ['wrote specs/01/a-report.html', 'wrote specs/02/b-report.html']);
  r = await run(['build', 'notes/other.md'], root);
  assert.equal(r.stdout, 'wrote notes/other.html');
});

test('theme is inlined and linted', async () => {
  const root = tempProject({
    'reports.json': JSON.stringify({ theme: 'reports/theme.css' }),
    'reports/theme.css': ':root { --accent: #c00; --made-up: 1px; }\n',
  });
  await run(['new', 'specs/t-report.md'], root);
  await run(['build'], root);
  const html = fs.readFileSync(path.join(root, 'specs/t-report.html'), 'utf8');
  assert.match(html, /--accent: #c00/);
  const r = await run(['lint'], root);
  assert.equal(r.code, 0, 'warnings only');
  assert.match(r.stdout, /reports\/theme\.css:1:\d+ +warning .*--made-up/);
});

test('syntax prints markdown and json from the registry', async () => {
  const root = tempProject({});
  let r = await run(['syntax'], root);
  assert.equal(r.code, 0); assert.match(r.stdout, /:::tldr/); assert.match(r.stdout, /::::cards/);
  r = await run(['syntax', '--json'], root);
  assert.deepEqual(JSON.parse(r.stdout).map((d) => d.name), ['tldr', 'cards', 'card', 'verdict']);
});

test('H1: non-.md paths are rejected by build and fmt, and never overwritten', async () => {
  const root = tempProject({ 'reports.json': CONFIG, 'notes.txt': 'precious\n', 'README.markdown': '# r\n' });
  for (const cmd of ['build', 'fmt', 'lint']) {
    for (const f of ['notes.txt', 'README.markdown']) {
      const r = await run([cmd, f], root);
      assert.equal(r.code, 2, `${cmd} ${f}`);
      assert.match(r.stderr, /not a Markdown report/);
    }
  }
  assert.equal(fs.readFileSync(path.join(root, 'notes.txt'), 'utf8'), 'precious\n');
});

test('directory arguments expand to the sources inside them', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  await run(['new', 'specs/01/a-report.md'], root);
  const r = await run(['lint', 'specs'], root);
  assert.equal(r.code, 0, r.stderr);
  const b = await run(['build', 'specs/01'], root);
  assert.equal(b.stdout, 'wrote specs/01/a-report.html');
});

test('absolute paths through a symlinked directory are inside the root', async () => {
  const real = tempProject({ 'reports.json': CONFIG });
  const link = `${real}-link`;
  fs.symlinkSync(real, link);
  await run(['new', 'specs/a-report.md'], real);
  const r = await run(['lint', path.join(link, 'specs/a-report.md')], link);
  assert.equal(r.code, 0, r.stderr);
});

test('M6: new quotes titles YAML would misread, and the skeleton stays lint-clean', async () => {
  const root = tempProject({ 'reports.json': JSON.stringify({ sources: ['specs/**/*-report.md'] }) });
  const cases = [['specs/null-report.md'], ['specs/true-report.md'], ['specs/2024-report.md'],
    ['specs/d-report.md', '--title', '- dash'], ['specs/q-report.md', '--title', '? q'], ['specs/h-report.md', '--title', '#hash'],
    ['specs/n-report.md', '--title', 'line one\nline two'], ['specs/c-report.md', '--title', 'a: b']];
  for (const args of cases) assert.equal((await run(['new', ...args], root)).code, 0, args.join(' '));
  const r = await run(['lint'], root);
  assert.equal(r.code, 0, r.stdout);
  assert.equal((await run(['fmt', '--check'], root)).code, 0);
});

test('H2: config rejects absolute paths; URLs are allowed for menu entries and icon', async () => {
  for (const cfg of [{ reports: [{ path: '/docs/index.html', label: 'x' }] }, { brand: { name: 'x', icon: '/img/i.png' } }, { theme: '/t.css' }, { sources: ['/abs/**/*.md'] }]) {
    const root = tempProject({ 'reports.json': JSON.stringify(cfg) });
    const r = await run(['build'], root);
    assert.equal(r.code, 2, JSON.stringify(cfg)); assert.match(r.stderr, /relative to the project root/);
  }
  const ok = tempProject({ 'reports.json': JSON.stringify({ reports: [{ path: 'https://github.com/x', label: 'GitHub' }], brand: { name: 'x', icon: 'https://cdn.example/i.png' } }) });
  assert.equal((await run(['build'], ok)).code, 0);
});

test('lint of explicit paths does not lint the theme; lint of all sources does', async () => {
  const root = tempProject({ 'reports.json': JSON.stringify({ theme: 't.css' }), 't.css': ':root { --nope: 1; }\n' });
  await run(['new', 'specs/a-report.md'], root);
  assert.doesNotMatch((await run(['lint', 'specs/a-report.md'], root)).stdout, /t\.css/);
  assert.match((await run(['lint'], root)).stdout, /t\.css/);
});

test('lint over all sources reports menu entries pointing at missing files', async () => {
  const cfg = { reports: [{ path: 'specs/a-report.md', label: 'A' }, { path: 'specs/gone-report.md', label: 'Gone' }, { path: 'specs/a-report.html#top', label: 'A2' }, { path: 'https://x.example', label: 'X' }] };
  const root = tempProject({ 'reports.json': JSON.stringify(cfg, null, 2) });
  await run(['new', 'specs/a-report.md'], root);
  const r = await run(['lint'], root);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /^reports\.json:\d+:\d+ +error +menu entry "Gone" points at "specs\/gone-report\.md", which does not exist +\[menu\]$/m);
  assert.doesNotMatch(r.stdout, /"A2"|"X"|"A"/);
  assert.equal((await run(['check'], root)).code, 1);
});

test('check reports orphaned HTML whose source report was deleted', async () => {
  const root = tempProject({ 'reports.json': CONFIG, 'specs/hand-written.html': '<!doctype html><p>not ours</p>' });
  await run(['new', 'specs/01/a-report.md'], root);
  await run(['new', 'specs/01/b-report.md'], root);
  await run(['build'], root);
  fs.unlinkSync(path.join(root, 'specs/01/b-report.md'));
  const r = await run(['build', '--check'], root);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /specs\/01\/b-report\.html: orphaned; its source specs\/01\/b-report\.md is gone \(delete the HTML\)/);
  assert.doesNotMatch(r.stderr, /hand-written/);
});

test('new warns when the path is outside sources', async () => {
  const root = tempProject({ 'reports.json': CONFIG });
  const r = await run(['new', 'outside/foo-report.md'], root);
  assert.equal(r.code, 0);
  assert.match(r.stderr, /not matched by "sources"/);
  assert.equal((await run(['new', 'specs/in-report.md'], root)).stderr, '');
});

test('build --watch picks up new reports, reports.json changes and survives deletions', async () => {
  const { spawn } = await import('node:child_process');
  const root = tempProject({ 'reports.json': JSON.stringify({ brand: { name: 'One' } }) });
  await run(['new', 'specs/a-report.md'], root);
  const child = spawn(process.execPath, [path.join(import.meta.dirname, '../src/index.mjs'), 'build', '--watch'], { cwd: root });
  let stderr = ''; child.stderr.on('data', (d) => { stderr += d; });
  const until = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
  const read = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };
  try {
    assert.ok(await until(() => read('specs/a-report.html').includes('One')), 'initial build');
    await new Promise((r) => setTimeout(r, 300));
    fs.writeFileSync(path.join(root, 'reports.json'), JSON.stringify({ brand: { name: 'Two' } }));
    assert.ok(await until(() => read('specs/a-report.html').includes('Two')), 'config change rebuilds with the new config');
    await run(['new', 'specs/b-report.md'], root);
    assert.ok(await until(() => read('specs/b-report.html').includes('Two')), 'new report picked up');
    fs.unlinkSync(path.join(root, 'specs/a-report.md'));
    fs.appendFileSync(path.join(root, 'specs/b-report.md'), '\nMore text.\n');
    assert.ok(await until(() => read('specs/b-report.html').includes('More text.')), 'deletion does not stop the batch');
    assert.doesNotMatch(stderr, /Cannot read properties/);
  } finally { child.kill(); }
});
