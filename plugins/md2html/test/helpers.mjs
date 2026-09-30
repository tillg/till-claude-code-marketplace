// Shared test helpers: temp projects on real disk, and running the CLI in-process or as a child.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const PLUGIN = path.resolve(import.meta.dirname, '..');
export const DIST = path.join(PLUGIN, 'dist', 'md2html.mjs');

export function tempProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'md2html-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

export function runNode(args, { cwd, input, env } = {}) {
  const r = spawnSync(process.execPath, args, { cwd, input, env: { ...process.env, ...env }, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

export const today = () => {
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
