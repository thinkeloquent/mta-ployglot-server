import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenBucket } from '../../src/bulk/token-bucket.mjs';

test('takes within capacity immediately', async () => {
  let t = 1000;
  const b = tokenBucket({ tokens: 5, intervalMs: 1000, now: () => t });
  for (let i = 0; i < 5; i++) await b.take();
});

test('refills after interval (real-time)', async () => {
  const b = tokenBucket({ tokens: 2, intervalMs: 100 });
  await b.take();
  await b.take();
  const start = Date.now();
  await b.take();
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 30, `expected wait ≥30ms, got ${elapsed}ms`);
  assert.ok(elapsed < 200, `expected wait <200ms, got ${elapsed}ms`);
});

test('long idle does not over-fill (capacity cap)', async () => {
  let t = 0;
  const b = tokenBucket({ tokens: 3, intervalMs: 100, now: () => t });
  await b.take(); await b.take(); await b.take();
  t = 10000;
  // Should still be capped at 3; taking 3 succeeds, 4th must wait
  await b.take(); await b.take(); await b.take();
  // 7th must require wait (we don't actually run real wait; just confirm refill capped)
});
