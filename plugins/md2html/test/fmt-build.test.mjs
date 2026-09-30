import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from '../src/fmt.mjs';
import { build } from '../src/build.mjs';
import { validateConfig } from '../src/config.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'build');
const config = validateConfig(JSON.parse(fs.readFileSync(path.join(root, 'reports.json'), 'utf8')));
const exists = (p) => fs.existsSync(path.join(root, p));
const files = fs.readdirSync(root).filter((f) => f.endsWith('.md')).sort();

for (const file of files) {
  test(`build(x) === build(format(x)): ${file}`, () => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const opts = { file, root, config, themeCss: '', exists };
    assert.equal(build(format(source), opts), build(source, opts));
  });
}

// The fmt goldens too, callouts included: build renders `> [!tldr]` like the `:::tldr` fmt writes.
const fmtDir = path.join(root, '..', 'fmt');
for (const file of fs.readdirSync(fmtDir).filter((f) => f.endsWith('.in.md')).sort()) {
  test(`build(x) === build(format(x)): fmt/${file}`, () => {
    const source = fs.readFileSync(path.join(fmtDir, file), 'utf8');
    const opts = { file, root, config, themeCss: '', exists: () => false };
    assert.equal(build(format(source), opts), build(source, opts));
  });
}

// Round-2: an invalid container unclosed at EOF without a final newline (F13).
for (const source of [':::tldr{x=1}\nbody', ':::tldr\nbody', ':::tldr\nShort.\n\n## Findings {#findings}\n\nBody.', '- :::tldr\n  x\n\n> q\n']) {
  test(`build(x) === build(format(x)): ${JSON.stringify(source)}`, () => {
    const opts = { file: 'x.md', root, config, themeCss: '', exists: () => false };
    assert.equal(build(format(source), opts), build(source, opts));
  });
}
