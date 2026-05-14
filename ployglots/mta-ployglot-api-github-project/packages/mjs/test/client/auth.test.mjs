import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAuth } from '../../src/client/auth.mjs';

test('string token resolves to Bearer header', async () => {
  assert.equal(await makeAuth('abc')(), 'Bearer abc');
});

test('async function token resolves to Bearer header', async () => {
  assert.equal(await makeAuth(async () => 'xyz')(), 'Bearer xyz');
});

test('non-string non-function throws', () => {
  assert.throws(() => makeAuth(123), /must be a string or a function/);
});
