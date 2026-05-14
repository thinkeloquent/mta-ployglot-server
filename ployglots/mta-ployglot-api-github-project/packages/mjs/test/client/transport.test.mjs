import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transport } from '../../src/client/transport.mjs';

function stubFetch(response) {
  return async (url, init) => {
    const status = response.status ?? 200;
    const body = (status === 204 || status === 205 || status === 304) ? null : (response.body ?? '');
    return new Response(body, {
      status,
      headers: response.headers ?? { 'content-type': 'application/json' },
    });
  };
}

test('parses JSON body and returns status', async () => {
  const fetchFn = stubFetch({ body: JSON.stringify({ hello: 'world' }) });
  const res = await transport({ url: 'https://example.com', body: '{}', fetch: fetchFn });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { hello: 'world' });
});

test('non-JSON body returned as string', async () => {
  const fetchFn = stubFetch({ body: 'plain', headers: { 'content-type': 'text/plain' } });
  const res = await transport({ url: 'https://example.com', fetch: fetchFn });
  assert.equal(res.body, 'plain');
});

test('500 does not throw', async () => {
  const fetchFn = stubFetch({ status: 500, body: '' });
  const res = await transport({ url: 'https://example.com', fetch: fetchFn });
  assert.equal(res.status, 500);
});

test('empty body returns null', async () => {
  const fetchFn = stubFetch({ status: 204, body: '' });
  const res = await transport({ url: 'https://example.com', fetch: fetchFn });
  assert.equal(res.body, null);
});
