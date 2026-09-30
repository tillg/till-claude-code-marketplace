import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, ConfigError } from '../src/config.mjs';
import { profileOf } from '../src/profile.mjs';

const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.esm.min.mjs';

test('specs absent → null (report projects unchanged)', () => {
  assert.equal(validateConfig({}).specs, null);
});

test('specs: {} turns the profile on with every default', () => {
  assert.deepEqual(validateConfig({ specs: {} }).specs, { sources: ['specs/**/*.md'], index: 'index.html', mermaid: MERMAID });
});

test('specs sub-keys override the defaults', () => {
  const specs = validateConfig({ specs: { sources: ['specs/changes/**/*.md'], index: 'specs/index.html', mermaid: 'https://x.test/m.mjs' } }).specs;
  assert.deepEqual(specs, { sources: ['specs/changes/**/*.md'], index: 'specs/index.html', mermaid: 'https://x.test/m.mjs' });
});

test('default sources are not shared between configs', () => {
  validateConfig({ specs: {} }).specs.sources.push('x');
  assert.deepEqual(validateConfig({ specs: {} }).specs.sources, ['specs/**/*.md']);
});

for (const [name, specs, msg] of [
  ['unknown sub-key', { index: 'i.html', extra: 1 }, /"specs" has unknown key "extra"/],
  ['not an object', [], /"specs" must be an object/],
  ['null', null, /"specs" must be an object/],
  ['sources not strings', { sources: [1] }, /"specs.sources" must be an array/],
  ['sources not array', { sources: 'specs/**/*.md' }, /"specs.sources" must be an array/],
  ['absolute source', { sources: ['/specs/**/*.md'] }, /"specs.sources\[0\]" "\/specs\/\*\*\/\*\.md" must be a path relative/],
  ['absolute index', { index: '/index.html' }, /"specs.index" "\/index.html" must be a path relative/],
  ['windows index', { index: 'C:\\x\\index.html' }, /"specs.index" .* must be a path relative/],
  ['URL index', { index: 'https://x.test/index.html' }, /"specs.index" .* must be a path relative/],
  ['empty index', { index: '' }, /"specs.index" must be a path string/],
  ['http mermaid', { mermaid: 'http://x.test/m.mjs' }, /"specs.mermaid" must be an https URL/],
  ['relative mermaid', { mermaid: 'mermaid.mjs' }, /"specs.mermaid" must be an https URL/],
  ['mermaid with space', { mermaid: 'https://x.test/a b.mjs' }, /"specs.mermaid" must be an https URL/],
]) {
  test(`specs rejected: ${name}`, () => {
    assert.throws(() => validateConfig({ specs }), (e) => e instanceof ConfigError && msg.test(e.message));
  });
}

const both = validateConfig({ sources: ['specs/**/*.md'], specs: {} });
const reportOnly = validateConfig({ sources: ['specs/**/*-report.md'] });
const split = validateConfig({ sources: ['reports/**/*.md'], specs: { sources: ['specs/changes/**/*.md', 'specs/system/*.md'] } });

test('profileOf: report wins when both globs match', () => {
  assert.equal(profileOf('specs/changes/x/proposal.md', both), 'report');
  assert.equal(profileOf('specs/x-report.md', both), 'report');
  const dflt = validateConfig({ specs: {} });
  assert.equal(profileOf('specs/x-report.md', dflt), 'report');
  assert.equal(profileOf('specs/changes/x/proposal.md', dflt), 'spec');
});

test('profileOf: report-only config never yields spec', () => {
  assert.equal(profileOf('specs/x-report.md', reportOnly), 'report');
  assert.equal(profileOf('specs/changes/x/proposal.md', reportOnly), null);
});

test('profileOf: spec-only, report-only and neither in one config', () => {
  assert.equal(profileOf('specs/changes/x/plan.md', split), 'spec');
  assert.equal(profileOf('specs/system/overview.md', split), 'spec');
  assert.equal(profileOf('reports/q3.md', split), 'report');
  assert.equal(profileOf('specs/other/notes.md', split), null);
  assert.equal(profileOf('README.md', split), null);
});

test('profileOf: only .md files have a profile', () => {
  assert.equal(profileOf('specs/changes/x/plan.html', both), null);
  assert.equal(profileOf('specs/changes/x/diagram.mmd', both), null);
});
