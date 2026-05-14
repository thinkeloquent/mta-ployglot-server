import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadConfig, getFetchConfig, ConfigError } from '../src/index.mjs';

const FIXTURE = {
  endpoints: {
    llm001: {
      baseUrl: 'https://api.example.com/v1/chat',
      method: 'POST',
      headers: { Authorization: 'Bearer XYZ' },
      timeout: 8000,
      bodyType: 'json',
    },
    plaintext: {
      baseUrl: 'https://api.example.com/v1/raw',
      method: 'POST',
      headers: {},
      timeout: 5000,
      bodyType: 'text',
    },
    typed: {
      baseUrl: 'https://api.example.com/v1/x',
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      bodyType: 'json',
    },
  },
  intent_mapping: {},
};

test('getFetchConfig: happy path returns FetchConfig with all six fields', () => {
  loadConfig(FIXTURE);
  const fc = getFetchConfig('llm001', { prompt: 'Hello' });
  assert.equal(fc.serviceId, 'llm001');
  assert.equal(fc.url, 'https://api.example.com/v1/chat');
  assert.equal(fc.method, 'POST');
  assert.equal(fc.body, '{"prompt":"Hello"}');
  assert.equal(fc.headersTimeout, 8000);
  assert.equal(fc.headers['Content-Type'], 'application/json');
  assert.equal(fc.headers.Authorization, 'Bearer XYZ');
});

test('getFetchConfig: header merge order — defaults → endpoint → custom (FC3)', () => {
  loadConfig(FIXTURE);
  const fc = getFetchConfig('llm001', {}, {
    Authorization: 'Bearer OVERRIDE',
    'X-Trace-Id': 'abc',
  });
  assert.equal(fc.headers.Authorization, 'Bearer OVERRIDE');
  assert.equal(fc.headers['X-Trace-Id'], 'abc');
  assert.equal(fc.headers['Content-Type'], 'application/json');
});

test('getFetchConfig: endpoint Content-Type overrides default', () => {
  loadConfig(FIXTURE);
  const fc = getFetchConfig('typed', {});
  assert.equal(fc.headers['Content-Type'], 'application/xml');
});

test('getFetchConfig: bodyType=text → String coercion', () => {
  loadConfig(FIXTURE);
  const fc = getFetchConfig('plaintext', 'plain string');
  assert.equal(fc.body, 'plain string');
});

test('getFetchConfig: bodyType=json (default) → JSON.stringify', () => {
  loadConfig(FIXTURE);
  const fc = getFetchConfig('llm001', { a: 1, b: [2, 3] });
  assert.equal(fc.body, '{"a":1,"b":[2,3]}');
});

test('getFetchConfig: dotted prefix accepted', () => {
  loadConfig(FIXTURE);
  const fc = getFetchConfig('endpoints.llm001', {});
  assert.equal(fc.serviceId, 'llm001');
});

test('getFetchConfig: unknown id throws ConfigError with serviceId + available', () => {
  loadConfig(FIXTURE);
  try {
    getFetchConfig('nope', {});
    assert.fail('expected throw');
  } catch (e) {
    assert.ok(e instanceof ConfigError);
    assert.equal(e.serviceId, 'nope');
    assert.deepEqual(e.available.sort(), ['llm001', 'plaintext', 'typed']);
  }
});
