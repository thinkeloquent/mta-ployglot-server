import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFiles } from '../src/loader.mjs';
import { io } from '../src/_io.mjs';
import { cacheGet, cacheSet, clearCache } from '../src/cache.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'parity', 'fixtures', 'yaml');

beforeEach(() => clearCache());

test('cache miss reads disk; cache hit does not', async () => {
  const target = path.join(FIXTURES, 'a.yml');
  const spy = mock.method(io, 'readFile');
  try {
    await loadFiles([target]);
    await loadFiles([target]);
    assert.equal(spy.mock.callCount(), 1);
  } finally {
    spy.mock.restore();
  }
});

test('clone-on-read isolates callers', () => {
  cacheSet('/k', { a: 1, nested: { b: 2 } });
  const v1 = cacheGet('/k');
  v1.nested.b = 999;
  const v2 = cacheGet('/k');
  assert.equal(v2.nested.b, 2);
});

test('clearCache() returns prior size and empties store', () => {
  cacheSet('/a', {});
  cacheSet('/b', {});
  assert.equal(clearCache(), 2);
  assert.equal(cacheGet('/a'), undefined);
});

test('clearCache(path) returns 1 if present, 0 if absent', () => {
  cacheSet('/a', {});
  assert.equal(clearCache('/a'), 1);
  assert.equal(clearCache('/a'), 0);
});
