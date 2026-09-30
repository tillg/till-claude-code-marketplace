import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN, tempProject, runNode } from './helpers.mjs';
import { skeleton } from '../src/cli.mjs';

const HOOK = path.join(PLUGIN, 'hooks/post-edit.mjs');
const hook = (filePath, cwd) => runNode([HOOK], { input: JSON.stringify({ tool_name: 'Edit', cwd, tool_input: { file_path: filePath } }) });
const CLEAN = skeleton('Hook', '2026-09-30');

test('hooks.json wires PostToolUse on Write|Edit|MultiEdit to post-edit.mjs', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks/hooks.json'), 'utf8'));
  const [entry] = cfg.hooks.PostToolUse;
  assert.equal(entry.matcher, 'Write|Edit|MultiEdit');
  assert.match(entry.hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/post-edit\.mjs/);
});

test('(a) a non-report .md in a project exits 0 silently and is untouched', () => {
  const root = tempProject({ 'reports.json': '{}', 'notes/x.md': '* messy\n' });
  const r = hook(path.join(root, 'notes/x.md'));
  assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', '']);
  assert.equal(fs.readFileSync(path.join(root, 'notes/x.md'), 'utf8'), '* messy\n');
});

test('(b) a clean report exits 0 silently', () => {
  const root = tempProject({ 'reports.json': '{}', 'specs/a-report.md': CLEAN });
  const r = hook(path.join(root, 'specs/a-report.md'));
  assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', '']);
});

test('(c) :::tdlr exits 2 with a suggestion on stderr', () => {
  const root = tempProject({ 'reports.json': '{}', 'specs/a-report.md': CLEAN.replace(':::tldr', ':::tdlr') });
  const r = hook(path.join(root, 'specs/a-report.md'));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown directive ":::tdlr"\. Did you mean ":::tldr"\?/);
});

test('(d) a file outside any reports.json project exits 0 silently', () => {
  const root = tempProject({ 'specs/a-report.md': CLEAN.replace(':::tldr', ':::tdlr') });
  const r = hook(path.join(root, 'specs/a-report.md'));
  assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', '']);
});

test('fmt rewrite is reported via additionalContext, and the file is rewritten', () => {
  const root = tempProject({ 'reports.json': '{}', 'specs/a-report.md': CLEAN.replace('- Where', '* Where') });
  const r = hook('specs/a-report.md', root);
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(out.hookSpecificOutput.additionalContext, /Read it again/);
  assert.equal(fs.readFileSync(path.join(root, 'specs/a-report.md'), 'utf8'), CLEAN);
});

test('non-.md files and garbage stdin exit 0', () => {
  const root = tempProject({ 'reports.json': '{}', 'specs/a.txt': 'x' });
  assert.equal(hook(path.join(root, 'specs/a.txt')).code, 0);
  assert.equal(runNode([HOOK], { input: 'not json' }).code, 0);
});

test('hook scope matches check: reports inside dot-dirs and node_modules are skipped', () => {
  const bad = CLEAN.replace(':::tldr', ':::tdlr');
  const root = tempProject({ 'reports.json': JSON.stringify({ sources: ['**/*-report.md'] }), '.worktrees/x/a-report.md': bad, 'node_modules/p/a-report.md': bad });
  for (const f of ['.worktrees/x/a-report.md', 'node_modules/p/a-report.md']) {
    const r = hook(path.join(root, f));
    assert.deepEqual([r.code, r.stderr], [0, ''], f);
  }
});

test('a report with lint errors is not rewritten by fmt (fmt must not hide an unclosed container)', () => {
  const src = CLEAN.replace(':::tldr\n**Short answer:** one or two sentences that answer the question this report asks.\n:::', ':::tldr\n**Short answer:** unclosed.\n\n* bullet');
  const root = tempProject({ 'reports.json': '{}', 'specs/a-report.md': src });
  const r = hook(path.join(root, 'specs/a-report.md'));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /never closed/);
  assert.equal(fs.readFileSync(path.join(root, 'specs/a-report.md'), 'utf8'), src, 'left untouched');
});

test('a directory named *.md exits 0 without crashing', () => {
  const root = tempProject({ 'reports.json': '{}', 'specs/dir-report.md/x.txt': 'x' });
  const r = hook(path.join(root, 'specs/dir-report.md'));
  assert.deepEqual([r.code, r.stderr], [0, '']);
});

test('spec files: hook lints frontmatter only, never formats or builds', () => {
  const good = '---\nfeature: add-x\ntitle: "Plan"\nstatus: proposed\ncreated: 2026-09-30\nedited: 2026-09-30\n---\n\n# Plan\n\n* [ ] step\n';
  const root = tempProject({ 'reports.json': JSON.stringify({ specs: {} }), 'specs/changes/add-x/plan.md': good });
  let r = hook(path.join(root, 'specs/changes/add-x/plan.md'));
  assert.equal(r.code, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'specs/changes/add-x/plan.md'), 'utf8'), good, 'not reformatted');
  assert.equal(fs.existsSync(path.join(root, 'specs/changes/add-x/plan.html')), false, 'no build');
  fs.writeFileSync(path.join(root, 'specs/changes/add-x/plan.md'), good.replace('status: proposed', 'status: done'));
  r = hook(path.join(root, 'specs/changes/add-x/plan.md'));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /status/);
});
