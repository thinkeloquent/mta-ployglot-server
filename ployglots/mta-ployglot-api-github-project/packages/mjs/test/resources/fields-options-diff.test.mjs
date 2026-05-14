import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOptionUpsertList } from '../../src/resources/fields-options-diff.mjs';

test('mix of {id,name} and {name} fills defaults', () => {
  const out = buildOptionUpsertList([
    { id: 'O1', name: 'A' },
    { name: 'B', color: 'BLUE', description: 'beep' },
  ]);
  assert.deepEqual(out, [
    { id: 'O1', name: 'A', color: 'GRAY', description: '' },
    { name: 'B', color: 'BLUE', description: 'beep' },
  ]);
});

test('empty input returns empty array', () => {
  assert.deepEqual(buildOptionUpsertList([]), []);
});
