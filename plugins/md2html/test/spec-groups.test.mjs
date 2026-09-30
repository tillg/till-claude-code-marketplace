import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groups, groupOf, labelOf } from '../src/spec/groups.mjs';
import { allGroups } from './spec-fixtures.mjs';

const fm = {
  'specs/changes/b/plan.md': { order: 4, title: 'Plan B', feature: 'b', status: 'applying', edited: '2026-09-02' },
  'specs/changes/b/proposal.md': { order: 1, title: 'Proposal B', feature: 'b', status: 'applying', edited: '2026-09-01' },
  'specs/changes/b/risks.md': { title: 'Risks B', feature: 'b', status: 'applying' },
  'specs/changes/b/decisions.md': { order: '5', feature: 'b' },
  'specs/changes/b/zeta.md': {},
  'specs/changes/a/notes.md': {},
  'specs/system/overview.md': { title: 'Overview', edited: '2026-08-01' },
};
const read = (f) => fm[f];

test('one group per directory, sorted by dir', () => {
  assert.deepEqual(groups(Object.keys(fm), read).map((g) => g.dir), ['specs/changes/a', 'specs/changes/b', 'specs/system']);
});

test('items sort by order, then file name; missing or non-integer order goes last', () => {
  const b = groups(Object.keys(fm), read)[1];
  assert.deepEqual(b.items.map((i) => i.file.split('/').pop()), ['proposal.md', 'plan.md', 'decisions.md', 'risks.md', 'zeta.md']);
});

test('item fields: frontmatter values, else null; title falls back to the label', () => {
  const b = groups(Object.keys(fm), read)[1];
  assert.deepEqual(b.items[0], { file: 'specs/changes/b/proposal.md', label: 'Proposal', order: 1, title: 'Proposal B', feature: 'b', status: 'applying', edited: '2026-09-01' });
  assert.deepEqual(b.items[4], { file: 'specs/changes/b/zeta.md', label: 'Zeta', order: null, title: 'Zeta', feature: null, status: null, edited: null });
  assert.equal(b.items[2].order, null);
});

test('labels come from the file name only', () => {
  assert.equal(labelOf('specs/changes/x/risks.md'), 'Risks');
  assert.equal(labelOf('x/open-questions.md'), 'Open questions');
  assert.equal(labelOf('x/api_design--notes.md'), 'Api design notes');
  assert.equal(labelOf('proposal.md'), 'Proposal');
});

test('no name is special: a new file joins its directory\'s group', () => {
  const g = groups(['d/proposal.md', 'd/anything.md'], () => ({}));
  assert.deepEqual(g, [{ dir: 'd', items: [
    { file: 'd/anything.md', label: 'Anything', order: null, title: 'Anything', feature: null, status: null, edited: null },
    { file: 'd/proposal.md', label: 'Proposal', order: null, title: 'Proposal', feature: null, status: null, edited: null },
  ] }]);
});

test('readFrontmatter returning undefined counts as {}; duplicates are ignored', () => {
  const g = groups(['d/a.md', 'd/a.md'], () => undefined);
  assert.equal(g[0].items.length, 1);
});

test('groupOf finds the group of a file by its directory', () => {
  const all = groups(Object.keys(fm), read);
  assert.equal(groupOf('specs/changes/b/risks.md', all).dir, 'specs/changes/b');
  assert.equal(groupOf('specs/changes/b/new.md', all).dir, 'specs/changes/b');
  assert.equal(groupOf('specs/elsewhere/x.md', all), undefined);
});

test('fixture groups: the change dir and the system dir', () => {
  assert.deepEqual(allGroups.map((g) => [g.dir, g.items.map((i) => i.label)]), [
    ['specs/changes/add-x', ['Proposal', 'Domain', 'Architecture', 'Plan', 'Open questions', 'Risks']],
    ['specs/system', ['Glossary', 'Overview']],
  ]);
});
