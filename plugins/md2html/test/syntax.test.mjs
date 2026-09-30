import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { syntaxMarkdown } from '../src/syntax.mjs';
import { PLUGIN } from './helpers.mjs';

test('skills/write/syntax.md matches `md2html syntax` (regenerate with `node src/index.mjs syntax > skills/write/syntax.md`)', () => {
  const committed = fs.readFileSync(path.join(PLUGIN, 'skills/write/syntax.md'), 'utf8');
  assert.equal(committed, `${syntaxMarkdown().trimEnd()}\n`);
});

test('every frontmatter example in the cheat sheet parses to what it shows', async () => {
  const { default: YAML } = await import('yaml');
  const md = syntaxMarkdown();
  const yaml = md.slice(md.indexOf('```yaml\n---\n') + 12, md.indexOf('\n---\n```'));
  const data = YAML.parse(yaml, { schema: 'core' });
  assert.equal(data.subtitle, 'Report for [spec #03](spec.md).');
});
