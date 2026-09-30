import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '../scripts/bundle.mjs';
import { DIST, PLUGIN, runNode } from './helpers.mjs';
import * as src from '../src/index.mjs';

test('dist/md2html.mjs is up to date with src/ (run `npm run bundle`)', async () => {
  assert.equal(fs.readFileSync(DIST, 'utf8'), await bundle({ write: false }));
});

test('dist builds every build fixture exactly like src/', async () => {
  const dist = await import(DIST);
  const dir = path.join(PLUGIN, 'test/fixtures/build');
  const config = src.validateConfig(JSON.parse(fs.readFileSync(path.join(dir, 'reports.json'), 'utf8')));
  const exists = (p) => fs.existsSync(path.join(dir, p));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  assert.ok(files.length > 5);
  for (const file of files) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const opts = { file, root: dir, config, themeCss: '', exists };
    assert.equal(dist.build(source, opts), fs.readFileSync(path.join(dir, file.replace(/\.md$/, '.html')), 'utf8'), file);
    assert.equal(dist.format(source), src.format(source), file);
  }
});

test('dist runs as a CLI and is importable without side effects', () => {
  const r = runNode([DIST, '--version']);
  assert.equal(r.code, 0); assert.equal(r.stdout.trim(), JSON.parse(fs.readFileSync(path.join(PLUGIN, 'package.json'))).version);
  const imp = runNode(['--input-type=module', '-e', `import(${JSON.stringify(DIST)}).then(m => console.log(typeof m.build))`]);
  assert.equal(imp.stdout.trim(), 'function');
});

test('the preset loads from dist', async () => {
  const dist = await import(DIST);
  assert.ok(Array.isArray(dist.preset.plugins) && dist.preset.plugins.length > 3);
});
