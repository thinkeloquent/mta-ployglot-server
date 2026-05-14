import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { deepMergeWithNullReplace } from '../src/deep-merge-null.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = pathResolve(__dirname, '../../../parity/deep-merge-null.json');
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));

for (const row of fixtures) {
  test(`parity row: ${row.name}`, () => {
    const result = deepMergeWithNullReplace(row.base, row.override);
    assert.deepEqual(result, row.expected);
  });
}

test('input is not mutated', () => {
  const base = { a: 1 };
  const override = { a: 2 };
  deepMergeWithNullReplace(base, override);
  assert.deepEqual(base, { a: 1 });
  assert.deepEqual(override, { a: 2 });
});

test('returns a new object', () => {
  const base = { a: 1 };
  const result = deepMergeWithNullReplace(base, {});
  assert.notEqual(result, base);
  assert.deepEqual(result, base);
});

test('parity fixture has six rows', () => {
  assert.equal(fixtures.length, 6);
});
