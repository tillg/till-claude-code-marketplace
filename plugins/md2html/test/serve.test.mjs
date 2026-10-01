// `md2html serve`: a local server that only hands out page files, never secrets or sources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tempProject, PLUGIN } from './helpers.mjs';

async function startServe(root, args = []) {
  const child = spawn(process.execPath, [path.join(PLUGIN, 'src/index.mjs'), 'serve', ...args], { cwd: root });
  let out = ''; child.stdout.on('data', (d) => { out += d; });
  let err = ''; child.stderr.on('data', (d) => { err += d; });
  for (let i = 0; i < 100 && !/http:\/\/localhost:\d+\//.test(out); i++) await new Promise((r) => setTimeout(r, 50));
  const url = /http:\/\/localhost:\d+\//.exec(out)?.[0];
  assert.ok(url, `serve printed its URL (stdout: ${out} stderr: ${err})`);
  return { child, url, out: () => out };
}
const get = async (url) => { const r = await fetch(url, { redirect: 'manual' }); return { status: r.status, type: r.headers.get('content-type'), body: await r.text(), location: r.headers.get('location') }; };

test('serves page files, blocks everything else', async () => {
  const root = tempProject({
    'reports.json': '{"specs":{}}', 'index.html': '<!doctype html><meta name="generator" content="md2html 0.3.0">idx',
    'specs/changes/a/proposal.html': '<p>page</p>', 'specs/changes/a/proposal.md': '# secret source',
    'docs/diagrams/x.svg': '<svg/>', 'docs/img/p.png': 'PNG', 'theme/a.css': 'body{}',
    '.env': 'TOKEN=secret', 'src/app.js': 'secret()', '.git/config': 'x', 'node_modules/m/a.html': 'x', '.hidden/a.html': 'x',
  });
  fs.symlinkSync('/etc', path.join(root, 'etc-link'));
  const { child, url } = await startServe(root);
  try {
    assert.equal((await get(`${url}index.html`)).status, 200);
    const page = await get(`${url}specs/changes/a/proposal.html`);
    assert.deepEqual([page.status, page.type.split(';')[0], page.body], [200, 'text/html', '<p>page</p>']);
    assert.equal((await get(`${url}docs/diagrams/x.svg`)).type.split(';')[0], 'image/svg+xml');
    assert.equal((await get(`${url}docs/img/p.png`)).status, 200);
    assert.equal((await get(`${url}theme/a.css`)).status, 200);
    for (const p of ['.env', 'src/app.js', 'specs/changes/a/proposal.md', '.git/config', 'node_modules/m/a.html', '.hidden/a.html',
      'etc-link/hosts', '..%2f..%2fetc%2fpasswd', '%2e%2e/%2e%2e/etc/passwd', 'reports.json', 'specs/', 'missing.html']) {
      assert.equal((await get(url + p)).status, 404, p);
    }
    const rootReq = await get(url);
    assert.equal(rootReq.status, 302); assert.equal(rootReq.location, '/index.html');
  } finally { child.kill(); }
});

test('binds to localhost only and honours --port', async () => {
  const root = tempProject({ 'reports.json': '{"specs":{}}', 'index.html': 'x' });
  const { child, url } = await startServe(root, ['--port', '0']);
  try { assert.match(url, /^http:\/\/localhost:\d+\/$/); } finally { child.kill(); }
});

test('serve needs a project (reports.json) and rejects a bad port', async () => {
  const { main } = await import('../src/cli.mjs');
  const errs = []; const out = { log: () => {}, err: (s) => errs.push(s) };
  assert.equal(await main(['serve'], { cwd: tempProject({ 'x.md': '' }), out }), 2);
  assert.equal(await main(['serve', '--port', 'abc'], { cwd: tempProject({ 'reports.json': '{}' }), out }), 2);
});
