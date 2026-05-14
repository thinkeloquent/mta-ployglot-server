import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deepMerge, mergeFiles } from '../src/merge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, '../../../parity/merge.json');
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));

for (const row of fixtures) {
  test(`deepMerge: ${row.name}`, () => {
    assert.deepEqual(deepMerge(row.base, row.override), row.expected);
  });
}

test('deepMerge does not alias source structures', () => {
  const base = { a: { b: 1 } };
  const override = { a: { c: 2 } };
  const out = deepMerge(base, override);
  out.a.b = 999;
  assert.equal(base.a.b, 1);
});

test('mergeFiles: empty map -> {}', () => {
  assert.deepEqual(mergeFiles(new Map()), {});
});

test('mergeFiles: null/undefined input -> {}', () => {
  assert.deepEqual(mergeFiles(null), {});
  assert.deepEqual(mergeFiles(undefined), {});
});

test('mergeFiles: later-file priority', () => {
  const loaded = new Map([
    ['a.yml', { x: 1, y: { p: 1 } }],
    ['b.yml', { x: 2, y: { q: 2 } }],
  ]);
  assert.deepEqual(mergeFiles(loaded), { x: 2, y: { p: 1, q: 2 } });
});

test('mergeFiles: tolerates null parsed values', () => {
  const loaded = new Map([
    ['a.yml', { x: 1 }],
    ['b.yml', null],
  ]);
  assert.deepEqual(mergeFiles(loaded), { x: 1 });
});
