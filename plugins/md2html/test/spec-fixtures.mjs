// Shared by the spec tests: build every spec page and the index in test/fixtures/spec/ from real files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../src/config.mjs';
import { matchesAny } from '../src/glob.mjs';
import { parse } from '../src/processor.mjs';
import { extractFrontmatter } from '../src/transforms/frontmatter.mjs';
import { groups, groupOf } from '../src/spec/groups.mjs';
import { buildSpec } from '../src/spec/build.mjs';
import { buildIndex } from '../src/spec/index.mjs';

export const dir = fileURLToPath(new URL('./fixtures/spec/', import.meta.url));
export const config = validateConfig(JSON.parse(fs.readFileSync(path.join(dir, 'reports.json'), 'utf8')));
export const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

function walk(rel) {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)]));
}
export const specFiles = walk('specs').filter((f) => f.endsWith('.md') && matchesAny(f, config.specs.sources)).sort();
export const readFrontmatter = (rel) => extractFrontmatter(parse(read(rel))).data;
export const allGroups = groups(specFiles, readFrontmatter);

export const buildCase = (file) => buildSpec(read(file), { file, config, group: groupOf(file, allGroups) });
export const buildIndexCase = () => buildIndex(allGroups, { config });
export const expectedPath = (file) => path.join(dir, file.replace(/\.md$/, '.html'));

// `node test/spec-fixtures.mjs` prints "<file> <sha256>" per page (determinism test);
// `node test/spec-fixtures.mjs --write` regenerates the goldens (review the diff by hand).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { createHash } = await import('node:crypto');
  const hash = (s) => createHash('sha256').update(s).digest('hex');
  const write = process.argv.includes('--write');
  for (const f of specFiles) {
    const out = buildCase(f);
    if (write) fs.writeFileSync(expectedPath(f), out); else console.log(f, hash(out));
  }
  const index = buildIndexCase();
  if (write) fs.writeFileSync(path.join(dir, config.specs.index), index); else console.log(config.specs.index, hash(index));
}
