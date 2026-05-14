import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pLimit } from '../../src/bulk/p-limit.mjs';

test('respects concurrency cap', async () => {
  const limit = pLimit(3);
  let active = 0, peak = 0;
  await Promise.all(Array.from({ length: 10 }, () =>
    limit(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 10));
      active--;
    }),
  ));
  assert.equal(peak, 3);
});

test('failure releases slot', async () => {
  const limit = pLimit(1);
  await assert.rejects(limit(async () => { throw new Error('x'); }));
  const r = await limit(async () => 42);
  assert.equal(r, 42);
});

test('pLimit(0) throws', () => {
  assert.throws(() => pLimit(0));
});

test('pLimit(non-int) throws', () => {
  assert.throws(() => pLimit(2.5));
});
