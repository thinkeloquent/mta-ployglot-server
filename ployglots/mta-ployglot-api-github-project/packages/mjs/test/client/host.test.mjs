import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../../src/index.mjs';

test('default host resolves to api.github.com', () => {
  const c = createClient({ token: 'x' });
  assert.equal(c._internals.baseUrls.graphql, 'https://api.github.com/graphql');
});

test('enterprise host resolves to /api/graphql', () => {
  const c = createClient({ token: 'x', host: 'github.acme.corp' });
  assert.equal(c._internals.baseUrls.graphql, 'https://github.acme.corp/api/graphql');
  assert.equal(c._internals.baseUrls.rest, 'https://github.acme.corp/api/v3');
});

test('host accepts full URL with scheme', () => {
  const c = createClient({ token: 'x', host: 'http://localhost:8080' });
  assert.equal(c._internals.baseUrls.graphql, 'http://localhost:8080/api/graphql');
});
