import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFiles } from '../src/loader.mjs';
import { LoadError } from '../src/errors.mjs';
import { clearCache } from '../src/cache.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'parity', 'fixtures', 'yaml');

beforeEach(() => clearCache());

test('default raises LoadError on missing file', async () => {
  await assert.rejects(
    () => loadFiles([path.join(FIXTURES, 'does-not-exist.yml')]),
    LoadError,
  );
});

test('missing: skip omits the entry and warns', async () => {
  const a = path.join(FIXTURES, 'a.yml');
  const missing = path.join(FIXTURES, 'does-not-exist.yml');
  const calls = [];
  const logger = { warn: (m) => calls.push(m) };
  const map = await loadFiles([a, missing], { missing: 'skip', logger });
  assert.deepEqual(Array.from(map.keys()), [a]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /does-not-exist\.yml/);
});

test('invalid missing strategy raises immediately', async () => {
  await assert.rejects(
    () => loadFiles(['/x.yml'], { missing: 'foo' }),
    /Invalid missing strategy/,
  );
});
