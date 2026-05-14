import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../../src/index.mjs';

test('proxy invalid URL throws ConfigurationError', () => {
  assert.throws(() => createClient({ token: 'x', proxy: 'not a url' }), (err) => err.name === 'ConfigurationError');
});

test('no proxy → dispatcher undefined', () => {
  const c = createClient({ token: 'x' });
  assert.equal(c._internals.dispatcher, undefined);
});

test('valid proxy → dispatcher set', async () => {
  const c = createClient({ token: 'x', proxy: 'http://proxy.acme:3128' });
  assert.ok(c._internals.dispatcher);
  await c._internals.dispatcher.close();
});

test('proxy URL with basic auth accepted', async () => {
  const c = createClient({ token: 'x', proxy: 'http://user:pass@proxy.acme:3128' });
  assert.ok(c._internals.dispatcher);
  await c._internals.dispatcher.close();
});

test('dispatcher is forwarded into fetch options', async () => {
  let observed;
  const fakeFetch = async (url, init) => {
    observed = init;
    return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const c = createClient({ token: 'x', proxy: 'http://proxy.acme:3128', fetch: fakeFetch });
  await c.graphql('query{}');
  assert.ok(observed.dispatcher, 'dispatcher should be passed to fetch');
  assert.equal(observed.dispatcher, c._internals.dispatcher);
  await c._internals.dispatcher.close();
});
