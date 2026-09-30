// Review fixes for the spec profile: report-wins, index path rules, watcher renames, hand-written HTML, hrefs, group status, --specs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { main } from '../src/cli.mjs';
import { validateConfig, loadConfig, ConfigError } from '../src/config.mjs';
import { profileOf } from '../src/profile.mjs';
import { groups, groupStatus } from '../src/spec/groups.mjs';
import { buildIndex } from '../src/spec/index.mjs';
import { renderSpecNav } from '../src/spec/build.mjs';
import { changeDir } from '../src/lint/spec-frontmatter.mjs';
import { lintSpec } from '../src/lint.mjs';
import { tempProject } from './helpers.mjs';

async function run(argv, cwd) {
  const out = { lines: [], errs: [] };
  const code = await main(argv, { cwd, out: { log: (s) => out.lines.push(s), err: (s) => out.errs.push(s) } });
  return { code, stdout: out.lines.join('\n'), stderr: out.errs.join('\n') };
}
const fm = (feature, status, order = null) => `---\nfeature: ${feature}\ntitle: "T"\nstatus: ${status}\n${order == null ? '' : `order: ${order}\n`}created: 2026-09-30\nedited: 2026-09-30\n---\n\n# T\n\nBody.\n`;
const REPORT = '---\ntitle: Bench\ncreated: 2026-09-30\nedited: 2026-09-30\nstatus: research\n---\n\n## Context {#context}\n\nText.\n';
const read = (root, f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return null; } };
const mtime = (root, f) => fs.statSync(path.join(root, f)).mtimeMs;
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };

// 1. Reports win over spec globs.
test('profileOf: a report glob match wins over the spec glob (incl. default *-report.md)', () => {
  const cfg = validateConfig({ specs: {} });
  assert.equal(profileOf('specs/research/cache-report.md', cfg), 'report');
  assert.equal(profileOf('specs/changes/x/proposal.md', cfg), 'spec');
});

test('build renders *-report.md under specs/ as reports and never removes their HTML', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/research/cache-report.md': REPORT, 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  const r = await run(['build'], root);
  assert.equal(r.code, 0, r.stderr);
  const html = read(root, 'specs/research/cache-report.html');
  assert.ok(html && !html.includes('class="spec-nav"'), 'report page, not a spec page');
  assert.doesNotMatch(read(root, 'index.html'), /cache-report/);
  const again = await run(['build'], root);
  assert.equal(again.stdout, '');
  assert.ok(read(root, 'specs/research/cache-report.html'));
});

// 2. An index under the spec glob is not a stale spec page.
test('an index under specs/ is not deleted and rewritten on every build', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{"index":"specs/index.html"}}', 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  assert.equal((await run(['build'], root)).code, 0);
  const before = mtime(root, 'specs/index.html');
  await new Promise((r) => setTimeout(r, 20));
  const again = await run(['build'], root);
  assert.equal(again.stdout, '', 'nothing removed or written');
  assert.equal(mtime(root, 'specs/index.html'), before);
});

// 3. Index collisions.
for (const [name, index, extra] of [
  ['a spec page', 'specs/changes/x/proposal.html', {}],
  ['specs/index.md', 'specs/index.html', { 'specs/index.md': '---\ntitle: "I"\ncreated: 2026-09-30\nedited: 2026-09-30\n---\n\n# I\n' }],
  ['a report', 'specs/research/cache-report.html', { 'specs/research/cache-report.md': REPORT }],
]) {
  test(`specs.index colliding with ${name} is a config error`, async () => {
    const root = tempProject({ 'reports.json': JSON.stringify({ specs: { index } }), 'specs/changes/x/proposal.md': fm('x', 'proposed'), ...extra });
    const r = await run(['build'], root);
    assert.equal(r.code, 2, r.stdout + r.stderr);
    assert.match(r.stderr, new RegExp(`specs\\.index.*${index.replace(/[.]/g, '\\.')}`));
  });
}

// 4. specs.index validation.
for (const [name, index] of [['not .html', 'notes.md'], ['.. segment', '../outside.html'], ['inner ..', 'specs/../../x.html']]) {
  test(`specs.index rejected: ${name}`, () => {
    assert.throws(() => validateConfig({ specs: { index } }), (e) => e instanceof ConfigError && /specs\.index/.test(e.message));
  });
}
test('specs.index that is an existing directory is a config error (exit 2), not a stack trace', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{"index":"site.html"}}', 'site.html/keep': '', 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  assert.throws(() => loadConfig(root), (e) => e instanceof ConfigError && /directory/.test(e.message));
  const r = await run(['build'], root);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /specs\.index.*directory/);
});

// 5. Watcher: directory renames.
test('build --watch rebuilds specs when a change directory is renamed or moved in', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/changes/b/proposal.md': fm('b', 'proposed'), 'elsewhere/d/proposal.md': fm('d', 'proposed') });
  const child = spawn(process.execPath, [path.join(import.meta.dirname, '../src/index.mjs'), 'build', '--watch'], { cwd: root });
  let log = ''; child.stdout.on('data', (d) => { log += d; });
  try {
    assert.ok(await until(() => log.includes('watching')), 'watcher started');
    assert.match(log, /watching 0 report\(s\) and 1 spec file\(s\)/);
    await new Promise((r) => setTimeout(r, 300));
    fs.renameSync(path.join(root, 'specs/changes/b'), path.join(root, 'specs/changes/c'));
    assert.ok(await until(() => read(root, 'index.html')?.includes('specs/changes/c/') && read(root, 'specs/changes/c/proposal.html')?.includes('spec-nav')), 'rename rebuilds index and page');
    assert.doesNotMatch(read(root, 'index.html'), /specs\/changes\/b\//);
    fs.renameSync(path.join(root, 'elsewhere/d'), path.join(root, 'specs/changes/d'));
    assert.ok(await until(() => read(root, 'index.html')?.includes('specs/changes/d/')), 'moved-in dir joins the index');
  } finally { child.kill(); }
});

// 6. Hand-written HTML next to a spec .md.
test('hand-written HTML next to a spec file is skipped with a warning; the rest builds', async () => {
  const hand = '<!doctype html><title>Mockup</title>';
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/system/mockup.md': '# Mockup\n', 'specs/system/mockup.html': hand, 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  const r = await run(['build'], root);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(read(root, 'specs/system/mockup.html'), hand);
  assert.match(r.stderr, /specs\/system\/mockup\.html exists and was not generated by md2html; not overwriting/);
  assert.ok(read(root, 'specs/changes/x/proposal.html'));
  assert.ok(read(root, 'index.html'));
});

// 7. A hand-written index does not block reports or spec pages.
test('a hand-written index fails the build only after reports and spec pages are written', async () => {
  const root = tempProject({ 'reports.json': '{"sources":["reports/*-report.md"],"specs":{}}', 'index.html': '<!doctype html><title>App</title>', 'reports/a-report.md': REPORT, 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  const r = await run(['build'], root);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /index\.html exists and was not generated by md2html; set "specs\.index"/);
  assert.ok(read(root, 'reports/a-report.html'), 'report built');
  assert.ok(read(root, 'specs/changes/x/proposal.html'), 'spec page built');
  assert.equal(read(root, 'index.html'), '<!doctype html><title>App</title>');
});

// 8. Archived changes.
test('changeDir: archived changes use their own directory name', () => {
  assert.equal(changeDir('specs/changes/archive/x/proposal.md'), 'x');
  assert.equal(changeDir('specs/changes/archive/x/notes/y.md'), 'x');
  assert.equal(changeDir('specs/changes/x/proposal.md'), 'x');
  assert.equal(changeDir('specs/changes/archive/proposal.md'), 'archive');
  const cfg = validateConfig({ specs: {} });
  const messages = lintSpec(fm('x', 'applied'), { file: 'specs/changes/archive/x/proposal.md', config: cfg });
  assert.deepEqual(messages.filter((m) => m.severity === 'error'), []);
  const g = groups(['specs/changes/archive/x/proposal.md', 'specs/changes/archive/y/proposal.md', 'specs/changes/z/proposal.md'], () => ({}));
  assert.deepEqual(g.map((x) => x.dir), ['specs/changes/archive/x', 'specs/changes/archive/y', 'specs/changes/z']);
});

// 9. Percent-encoded hrefs.
test('nav and index hrefs percent-encode path segments', () => {
  const cfg = validateConfig({ specs: {} });
  const files = ['specs/changes/ü/a#b.md', 'specs/changes/ü/q?x.md', 'specs/changes/ü/100%.md', 'specs/changes/ü/it\'s "q".md'];
  const all = groups(files, () => ({}));
  const nav = renderSpecNav({ file: files[0], config: cfg, group: all[0] });
  assert.match(nav, /href="a%23b\.html"/);
  assert.match(nav, /href="q%3Fx\.html"/);
  assert.match(nav, /href="100%25\.html"/);
  assert.match(nav, /href="it's%20%22q%22\.html"/);
  assert.match(nav, /href="\.\.\/\.\.\/\.\.\/index\.html"/);
  const index = buildIndex(all, { config: cfg });
  assert.match(index, /href="specs\/changes\/%C3%BC\/a%23b\.html"/);
  assert.match(index, /href="specs\/changes\/%C3%BC\/100%25\.html"/);
  assert.match(index, /<code>specs\/changes\/ü\/<\/code>/, 'display text stays readable');
});

// 10. One rule for a group's status.
test('groupStatus: majority, tie → lowest order, then first by name', () => {
  assert.equal(groupStatus([{ file: 'a/p.md', status: 'proposed', order: 1 }, { file: 'a/q.md', status: 'applying', order: 2 }, { file: 'a/r.md', status: 'applying', order: 3 }]), 'applying');
  assert.equal(groupStatus([{ file: 'a/z.md', status: 'applying', order: 2 }, { file: 'a/b.md', status: 'proposed', order: 1 }]), 'proposed');
  assert.equal(groupStatus([{ file: 'a/z.md', status: 'applying', order: null }, { file: 'a/b.md', status: 'proposed', order: null }]), 'proposed');
  assert.equal(groupStatus([{ file: 'a/b.md', status: null }]), null);
});

test('index shows the group status by majority, not the first item', () => {
  const cfg = validateConfig({ specs: {} });
  const data = { 'specs/changes/a/proposal.md': { status: 'proposed', order: 1 }, 'specs/changes/a/plan.md': { status: 'applying', order: 4 }, 'specs/changes/a/domain.md': { status: 'applying', order: 2 } };
  const index = buildIndex(groups(Object.keys(data), (f) => data[f]), { config: cfg });
  assert.match(index, /spec-status applying">Applying/);
  assert.doesNotMatch(index, /spec-status proposed/);
});

// 11. build --specs.
test('build --specs builds spec pages and the index only', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/research/cache-report.md': REPORT, 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  const r = await run(['build', '--specs'], root);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(read(root, 'specs/research/cache-report.html'), null, 'report not built');
  assert.ok(read(root, 'specs/changes/x/proposal.html'));
  assert.ok(read(root, 'index.html'));
  assert.equal((await run(['build', '--specs', '--check'], root)).code, 2);
  const none = tempProject({ 'reports.json': '{}', 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  const n = await run(['build', '--specs'], none);
  assert.equal(n.code, 2);
  assert.match(n.stderr, /specs/);
  assert.match((await run(['--help'], root)).stdout, /build \[--check\] \[--watch\] \[--specs\]/);
});

test('build --specs --watch rebuilds spec pages but never reports', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/research/cache-report.md': REPORT, 'specs/changes/x/proposal.md': fm('x', 'proposed') });
  const child = spawn(process.execPath, [path.join(import.meta.dirname, '../src/index.mjs'), 'build', '--specs', '--watch'], { cwd: root });
  let log = ''; child.stdout.on('data', (d) => { log += d; });
  try {
    assert.ok(await until(() => log.includes('watching')));
    assert.match(log, /watching 0 report\(s\) and 1 spec file\(s\)/);
    await new Promise((r) => setTimeout(r, 300));
    fs.appendFileSync(path.join(root, 'specs/research/cache-report.md'), '\nMore.\n');
    fs.appendFileSync(path.join(root, 'specs/changes/x/proposal.md'), '\nEdited.\n');
    assert.ok(await until(() => read(root, 'specs/changes/x/proposal.html')?.includes('Edited.')));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(read(root, 'specs/research/cache-report.html'), null);
  } finally { child.kill(); }
});
