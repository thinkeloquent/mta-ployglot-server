import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createEndpointConfig, createFetchConfig } from '../src/models.mjs';

test('createEndpointConfig: defaults applied', () => {
  const ep = createEndpointConfig({}, 'svc1');
  assert.equal(ep.key, 'svc1');
  assert.equal(ep.name, 'svc1');
  assert.deepEqual(ep.tags, []);
  assert.equal(ep.baseUrl, '');
  assert.equal(ep.description, '');
  assert.equal(ep.method, 'POST');
  assert.deepEqual(ep.headers, {});
  assert.equal(ep.timeout, 30000);
  assert.equal(ep.bodyType, 'json');
});

test('createEndpointConfig: name defaults to key, custom values respected', () => {
  const ep = createEndpointConfig(
    { name: 'gemini', tags: ['llm'], method: 'GET', timeout: 5000, bodyType: 'text' },
    'k',
  );
  assert.equal(ep.name, 'gemini');
  assert.deepEqual(ep.tags, ['llm']);
  assert.equal(ep.method, 'GET');
  assert.equal(ep.timeout, 5000);
  assert.equal(ep.bodyType, 'text');
});

test('createEndpointConfig: baseUrl preferred, baseurl legacy alias accepted', () => {
  assert.equal(createEndpointConfig({ baseUrl: 'A', baseurl: 'B' }).baseUrl, 'A');
  assert.equal(createEndpointConfig({ baseurl: 'B' }).baseUrl, 'B');
});

test('createEndpointConfig: input not mutated', () => {
  const input = { name: 'x', tags: ['a'], headers: { H: '1' } };
  const before = JSON.stringify(input);
  createEndpointConfig(input, 'k');
  assert.equal(JSON.stringify(input), before);
});

test('createEndpointConfig: deep-cloned tags + headers', () => {
  const input = { tags: ['t'], headers: { H: '1' } };
  const ep = createEndpointConfig(input, 'k');
  ep.tags.push('mutated');
  ep.headers.H = 'mutated';
  assert.deepEqual(input.tags, ['t']);
  assert.deepEqual(input.headers, { H: '1' });
});

test('createFetchConfig: timeout renamed to headersTimeout, six fields present', () => {
  const fc = createFetchConfig({
    serviceId: 'svc',
    url: 'https://x',
    method: 'POST',
    headers: { A: '1' },
    body: '{"k":1}',
    timeout: 7000,
  });
  assert.deepEqual(Object.keys(fc).sort(), [
    'body', 'headers', 'headersTimeout', 'method', 'serviceId', 'url',
  ]);
  assert.equal(fc.headersTimeout, 7000);
  assert.equal(fc.timeout, undefined);
});
