// Build every fixture twice in fresh processes with different TZ and LANG; hashes must match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./build-fixtures.mjs', import.meta.url));
const run = (env, cwd) => execFileSync(process.execPath, [script], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });

test('build output is independent of TZ and LANG', () => {
  const a = run({ TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
  const b = run({ TZ: 'Pacific/Kiritimati', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' });
  assert.ok(a.split('\n').filter(Boolean).length >= 13);
  assert.equal(a, b);
});

test('build output is independent of the working directory (absolute and URL config paths)', () => {
  const a = run({}, '/');
  const b = run({}, fileURLToPath(new URL('./fixtures/build/', import.meta.url)));
  assert.match(a, /^abs-config:/m);
  assert.equal(a, b);
});
