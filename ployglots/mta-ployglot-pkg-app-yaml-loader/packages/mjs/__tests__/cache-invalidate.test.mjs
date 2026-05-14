import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFiles } from '../src/loader.mjs';
import { io } from '../src/_io.mjs';
import { clearCache } from '../src/cache.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'parity', 'fixtures', 'yaml');

beforeEach(() => clearCache());

test('force: true re-reads disk even when cached', async () => {
  const target = path.join(FIXTURES, 'a.yml');
  const spy = mock.method(io, 'readFile');
  try {
    await loadFiles([target]);
    await loadFiles([target], { force: true });
    assert.equal(spy.mock.callCount(), 2);
  } finally {
    spy.mock.restore();
  }
});

test('clearCache(path) evicts a single entry; subsequent call re-reads', async () => {
  const target = path.join(FIXTURES, 'a.yml');
  const spy = mock.method(io, 'readFile');
  try {
    await loadFiles([target]);
    clearCache(path.resolve(target));
    await loadFiles([target]);
    assert.equal(spy.mock.callCount(), 2);
  } finally {
    spy.mock.restore();
  }
});

test('clearCache (no arg) returns prior cache size', async () => {
  await loadFiles([
    path.join(FIXTURES, 'a.yml'),
    path.join(FIXTURES, 'b.yml'),
  ]);
  assert.equal(clearCache(), 2);
});

test('clearCache importable from package main entry', async () => {
  const mod = await import('../src/index.mjs');
  assert.equal(typeof mod.clearCache, 'function');
});
