// Fixes from the headless Claude Code lifecycle dry run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findRoot } from '../src/config.mjs';
import { tempProject, runNode, PLUGIN } from './helpers.mjs';

const HOOK = path.join(PLUGIN, 'hooks/post-edit.mjs');
const fm = (status, order) => `---\nfeature: add-x\ntitle: "T${order}"\nstatus: ${status}\norder: ${order}\ncreated: 2026-09-30\nedited: 2026-09-30\n---\n\n# T\n`;

test('findRoot never walks above the enclosing git repository', () => {
  const outer = tempProject({ 'reports.json': '{"specs":{}}', 'inner/.git/HEAD': 'ref: refs/heads/main\n', 'inner/specs/x.md': '# x\n' });
  assert.equal(findRoot(path.join(outer, 'inner/specs')), null);
  fs.writeFileSync(path.join(outer, 'inner/reports.json'), '{}');
  assert.equal(findRoot(path.join(outer, 'inner/specs')), path.join(outer, 'inner'));
  assert.equal(findRoot(outer), outer);
  const worktree = tempProject({ 'reports.json': '{}', 'wt/.git': 'gitdir: /elsewhere\n' });
  assert.equal(findRoot(path.join(worktree, 'wt')), null, '.git file (worktree) is a boundary too');
});

test('hook warns (exit 0) when a spec file disagrees with its group', () => {
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/changes/add-x/proposal.md': fm('proposed', 1), 'specs/changes/add-x/domain.md': fm('proposed', 2), 'specs/changes/add-x/plan.md': fm('applied', 4) });
  const r = runNode([HOOK], { input: JSON.stringify({ tool_input: { file_path: path.join(root, 'specs/changes/add-x/plan.md') } }) });
  assert.equal(r.code, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /status "applied" differs[\s\S]*spec-consistency/);
});

test('build --watch prints spec lint errors of changed files', async () => {
  const { spawn } = await import('node:child_process');
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'specs/changes/add-x/proposal.md': fm('proposed', 1) });
  const child = spawn(process.execPath, [path.join(PLUGIN, 'src/index.mjs'), 'build', '--specs', '--watch'], { cwd: root });
  let stderr = ''; child.stderr.on('data', (d) => { stderr += d; });
  let stdout = ''; child.stdout.on('data', (d) => { stdout += d; });
  const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
  try {
    assert.ok(await until(() => stdout.includes('watching')));
    await new Promise((r) => setTimeout(r, 300));
    fs.writeFileSync(path.join(root, 'specs/changes/add-x/proposal.md'), fm('done', 1));
    assert.ok(await until(() => /status "done" is not allowed/.test(stderr)), stderr);
  } finally { child.kill(); }
});
