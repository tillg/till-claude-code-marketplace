// Shared by the build tests: build every fixture in test/fixtures/build/ with the real filesystem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../src/build.mjs';
import { validateConfig } from '../src/config.mjs';

export const dir = fileURLToPath(new URL('./fixtures/build/', import.meta.url));
export const config = validateConfig(JSON.parse(fs.readFileSync(path.join(dir, 'reports.json'), 'utf8')));
export const cases = fs.readdirSync(dir).filter((f) => f.endsWith('-report.md')).sort();
export const exists = (rel) => fs.existsSync(path.join(dir, rel));

export function buildCase(file) {
  return build(fs.readFileSync(path.join(dir, file), 'utf8'), { file, root: dir, config, exists });
}

// Absolute paths and URLs in the config: the page must not depend on process.cwd().
export const absConfig = {
  ...config,
  brand: { name: 'Abs', icon: '/abs/icon.svg' },
  reports: [
    { path: '/abs/minimal-report.md', label: 'Abs' },
    { path: 'https://github.com/x', label: 'URL' },
    { path: '//cdn.example.com/y.html', label: 'Host' },
  ],
};

// `node test/build-fixtures.mjs` prints "<file> <sha256>" per fixture (used by determinism.test.mjs).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { createHash } = await import('node:crypto');
  const hash = (s) => createHash('sha256').update(s).digest('hex');
  for (const f of cases) console.log(f, hash(buildCase(f)));
  const f = 'kitchen-sink-report.md';
  console.log(`abs-config:${f}`, hash(build(fs.readFileSync(path.join(dir, f), 'utf8'), { file: `sub/${f}`, root: dir, config: absConfig, exists })));
}
