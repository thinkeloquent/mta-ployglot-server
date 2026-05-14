import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../../src/client/retry.mjs';

test('502 then 200 returns 200', async () => {
  let n = 0;
  const res = await withRetry(async () => {
    n++;
    if (n < 3) return { status: 502, headers: {}, body: '' };
    return { status: 200, headers: {}, body: { ok: 1 } };
  }, { baseDelayMs: 1 });
  assert.equal(res.status, 200);
  assert.equal(n, 3);
});

test('403 with x-ratelimit-remaining: 0 retries', async () => {
  let n = 0;
  const past = Math.floor(Date.now() / 1000) - 1;
  const res = await withRetry(async () => {
    n++;
    if (n === 1) return { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(past) }, body: '' };
    return { status: 200, headers: {}, body: { ok: 1 } };
  }, { baseDelayMs: 1 });
  assert.equal(res.status, 200);
  assert.equal(n, 2);
});

test('403 with secondary rate limit body retries', async () => {
  let n = 0;
  const res = await withRetry(async () => {
    n++;
    if (n === 1) return { status: 403, headers: {}, body: 'You have exceeded a secondary rate limit' };
    return { status: 200, headers: {}, body: { ok: 1 } };
  }, { baseDelayMs: 1 });
  assert.equal(res.status, 200);
});

test('max-attempts exceeded throws GitHubHTTPError', async () => {
  await assert.rejects(
    withRetry(async () => ({ status: 500, headers: {}, body: '' }), { maxAttempts: 2, baseDelayMs: 1 }),
    (err) => err.name === 'GitHubHTTPError' && err.status === 500
  );
});

test('non-retryable status returns immediately', async () => {
  let n = 0;
  const res = await withRetry(async () => { n++; return { status: 404, headers: {}, body: 'nope' }; }, { baseDelayMs: 1 });
  assert.equal(res.status, 404);
  assert.equal(n, 1);
});
