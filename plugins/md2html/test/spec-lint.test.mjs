import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lint, lintSpec, lintSpecGroup, specData, formatMessages } from '../src/lint.mjs';

const dir = new URL('./fixtures/spec-lint/', import.meta.url).pathname;
const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const cases = fs.readdirSync(dir, { recursive: true }).map((f) => f.split(path.sep).join('/'))
  .filter((f) => f.endsWith('.expected.txt')).map((f) => f.replace('.expected.txt', '.md')).sort();
const lintCase = (rel) => lintSpec(read(rel), { file: rel, root: dir });
const format = (messages) => messages.map((m) => `${m.file}:${m.line}:${m.column}  ${m.severity}  ${m.message}  [${m.ruleId}]`).join('\n');

for (const rel of cases) {
  test(`spec lint fixture ${rel}`, () => {
    const text = formatMessages(lintCase(rel), rel);
    assert.equal(text ? `${text}\n` : '', read(rel.replace(/\.md$/, '.expected.txt')));
  });
}

test('every spec fixture has an expected file', () => {
  for (const sub of ['specs/changes/add-x', 'specs/system']) {
    for (const f of fs.readdirSync(path.join(dir, sub)).filter((n) => n.endsWith('.md'))) {
      assert.ok(cases.includes(`${sub}/${f}`), `${sub}/${f}`);
    }
  }
});

test('clean change file and system doc (no feature/status) yield no messages', () => {
  assert.deepEqual(lintCase('specs/changes/add-x/clean.md'), []);
  assert.deepEqual(lintCase('specs/system/overview.md'), []);
});

test('report-only rules never run; other rules are warnings', () => {
  const messages = lintCase('specs/changes/add-x/downgraded.md');
  assert.ok(messages.length >= 3);
  assert.ok(messages.every((m) => m.severity === 'warning'), format(messages));
  assert.ok(!messages.some((m) => ['frontmatter', 'heading-number'].includes(m.ruleId)));
  // The same file as a report: report frontmatter and section-number rules fire, as errors/warnings.
  const asReport = lint(read('specs/changes/add-x/downgraded.md'), { file: 'specs/changes/add-x/downgraded.md', root: dir });
  assert.ok(asReport.some((m) => m.ruleId === 'frontmatter' && m.severity === 'error'));
  assert.ok(asReport.some((m) => m.ruleId === 'heading-number'));
  assert.ok(asReport.some((m) => m.ruleId === 'directive-known' && m.severity === 'error'));
});

test('feature/status are required only under specs/changes/<dir>/', () => {
  const source = read('specs/changes/add-x/missing-keys.md');
  const required = (file) => lintSpec(source, { file, root: dir }).map((m) => m.message).filter((m) => m.startsWith('missing'));
  assert.deepEqual(required('specs/changes/add-x/x.md'), ['missing required frontmatter key "feature"', 'missing required frontmatter key "status"', 'missing required frontmatter key "title"']);
  assert.deepEqual(required('specs/system/x.md'), ['missing required frontmatter key "title"']);
  assert.deepEqual(required('docs/specs/changes/add-x/x.md'), required('specs/changes/add-x/x.md'));
});

test('mismatched group: errors on the odd file out', () => {
  const files = fs.readdirSync(path.join(dir, 'specs/changes/mixed')).sort().map((n) => `specs/changes/mixed/${n}`);
  const items = files.map((file) => ({ file, ...specData(read(file)) }));
  assert.equal(`${format(lintSpecGroup(items))}\n`, read('mixed.group.txt'));
});

test('group: agreeing files, missing values and ties', () => {
  const a = { file: 'specs/changes/x/a.md', feature: 'x', status: 'proposed', order: 2 };
  const b = { file: 'specs/changes/x/b.md', feature: 'x', status: 'applying', order: 1, lines: { status: 4 } };
  assert.deepEqual(lintSpecGroup([a, { ...b, status: 'proposed' }, { file: 'specs/changes/x/c.md' }]), []);
  // Tie: the file with the lowest `order` (b) sets the value.
  assert.deepEqual(format(lintSpecGroup([a, b])), 'specs/changes/x/a.md:1:1  error  status "proposed" differs from the rest of specs/changes/x/ ("applying")  [spec-consistency]');
  // Tie without order: the first file wins; `line` is the fallback position.
  const [c, d] = [{ file: 'specs/changes/x/c.md', status: 'paused' }, { file: 'specs/changes/x/d.md', status: 'applied', line: 3 }];
  assert.deepEqual(format(lintSpecGroup([c, d])), 'specs/changes/x/d.md:3:1  error  status "applied" differs from the rest of specs/changes/x/ ("paused")  [spec-consistency]');
});

test('specData: values and key lines; null without frontmatter', () => {
  assert.deepEqual(specData(read('specs/changes/add-x/clean.md')), {
    feature: 'add-x', title: 'Proposal: add x', status: 'proposed', order: 1, created: '2026-09-01', edited: '2026-09-02',
    lines: { feature: 2, title: 3, status: 4, order: 5, created: 6, edited: 7 },
  });
  assert.equal(specData(read('specs/changes/add-x/no-frontmatter.md')), null);
  assert.equal(specData(read('specs/changes/add-x/invalid-yaml.md')), null);
});

test('CRLF and BOM input lint like LF', () => {
  for (const rel of ['specs/changes/add-x/bad-date.md', 'specs/changes/add-x/downgraded.md']) {
    assert.deepEqual(lintSpec(read(rel).replace(/\n/g, '\r\n'), { file: rel, root: dir }), lintCase(rel), rel);
    assert.deepEqual(lintSpec(`﻿${read(rel)}`, { file: rel, root: dir }), lintCase(rel), rel);
  }
});

test('odd YAML never throws and prints nothing to stderr', () => {
  const script = `
    import { lintSpec, specData } from ${JSON.stringify(new URL('../src/lint.mjs', import.meta.url).href)};
    const fm = (extra) => '---\\nfeature: a\\ntitle: x\\nstatus: proposed\\ncreated: 2026-09-01\\nedited: 2026-09-01\\n' + extra + '\\n---\\n';
    for (const extra of ['order: !foo x', '%FOO', 'order:\\n  ? [a]\\n  : b', 'title: *Draft*', 'order: &x 1', 'feature: [a, b]', '- a']) {
      lintSpec(fm(extra), { file: 'specs/changes/a/p.md' }); specData(fm(extra));
    }
    for (const src of ['---\\n---\\n', '---\\n- a\\n---\\n', '---\\nfoo\\n---\\n']) { lintSpec(src, { file: 'specs/changes/a/p.md' }); specData(src); }
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
});
