// Build every spec fixture (and the index) in fresh processes with different TZ, LANG and cwd; hashes must match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./spec-fixtures.mjs', import.meta.url));
const run = (env, cwd) => execFileSync(process.execPath, [script], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });

test('spec output is independent of TZ, LANG and the working directory', () => {
  const a = run({ TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }, '/');
  const b = run({ TZ: 'Pacific/Kiritimati', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' }, fileURLToPath(new URL('./fixtures/spec/', import.meta.url)));
  assert.equal(a.split('\n').filter(Boolean).length, 9);
  assert.equal(a, b);
});
