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

test('happy path: two files, key order = input order', async () => {
  const a = path.join(FIXTURES, 'a.yml');
  const b = path.join(FIXTURES, 'b.yml');
  const map = await loadFiles([a, b]);
  assert.deepEqual(Array.from(map.keys()), [a, b]);
  assert.equal(map.get(a).name, 'alpha');
  assert.equal(map.get(b).nested.key, 'value');
});

test('empty file → {} not null', async () => {
  const e = path.join(FIXTURES, 'empty.yml');
  const map = await loadFiles([e]);
  assert.deepEqual(map.get(e), {});
});

test('parse error wraps in LoadError with .path', async () => {
  const bad = path.join(FIXTURES, 'invalid.yml');
  await assert.rejects(
    () => loadFiles([bad]),
    (err) => err instanceof LoadError && err.path === bad,
  );
});

test('non-string path raises TypeError', async () => {
  await assert.rejects(() => loadFiles([42]), TypeError);
});

test('relative paths resolve to absolute keys', async () => {
  const abs = path.join(FIXTURES, 'a.yml');
  const rel = path.relative(process.cwd(), abs);
  const map = await loadFiles([rel]);
  assert.equal(Array.from(map.keys())[0], abs);
});
