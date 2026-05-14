import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, version } from '../src/index.mjs';

test('exports version', () => {
  assert.equal(typeof version, 'string');
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('createClient requires token', () => {
  assert.throws(() => createClient(), /token is required/);
});

test('createClient returns graphql/rest', () => {
  const c = createClient({ token: 'x' });
  assert.equal(typeof c.graphql, 'function');
  assert.equal(typeof c.rest, 'function');
});
