import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBaseUrls } from '../../src/client/urls.mjs';

test('default host', () => {
  assert.deepEqual(resolveBaseUrls(), {
    graphql: 'https://api.github.com/graphql',
    rest: 'https://api.github.com',
    uploads: 'https://uploads.github.com',
  });
});

test('bare hostname', () => {
  assert.equal(resolveBaseUrls('github.acme.corp').graphql, 'https://github.acme.corp/api/graphql');
  assert.equal(resolveBaseUrls('github.acme.corp').rest, 'https://github.acme.corp/api/v3');
  assert.equal(resolveBaseUrls('github.acme.corp').uploads, 'https://github.acme.corp/api/uploads');
});

test('full URL with scheme', () => {
  assert.equal(resolveBaseUrls('https://github.acme.corp').graphql, 'https://github.acme.corp/api/graphql');
});

test('preserves http for localhost', () => {
  assert.equal(resolveBaseUrls('http://localhost:8080').rest, 'http://localhost:8080/api/v3');
});

test('tolerates trailing slash', () => {
  assert.equal(resolveBaseUrls('github.acme.corp/').rest, 'https://github.acme.corp/api/v3');
});
