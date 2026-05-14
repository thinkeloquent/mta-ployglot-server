import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../../src/index.mjs';

function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = handler(url, init);
    const status = r.status ?? 200;
    const body = (status === 204 || status === 205 || status === 304) ? null : (r.body ?? '');
    return new Response(body, { status, headers: r.headers ?? { 'content-type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}

test('graphql posts to api.github.com with bearer token', async () => {
  const fetch = stubFetch(() => ({ body: JSON.stringify({ data: { ok: true } }) }));
  const c = createClient({ token: 'pat', fetch });
  const data = await c.graphql('query { viewer { login } }');
  assert.deepEqual(data, { ok: true });
  assert.equal(fetch.calls[0].url, 'https://api.github.com/graphql');
  assert.equal(fetch.calls[0].init.headers['authorization'], 'Bearer pat');
  assert.equal(fetch.calls[0].init.method, 'POST');
});

test('missing token throws', () => {
  assert.throws(() => createClient({}), /token is required/);
});

test('rest 204 returns null', async () => {
  const fetch = stubFetch(() => ({ status: 204, body: '' }));
  const c = createClient({ token: 'x', fetch });
  const out = await c.rest('DELETE', '/repos/o/r/issues/1');
  assert.equal(out, null);
});

test('401 throws GitHubAuthError', async () => {
  const fetch = stubFetch(() => ({ status: 401, body: JSON.stringify({ message: 'Bad creds' }) }));
  const c = createClient({ token: 'bad', fetch });
  await assert.rejects(c.graphql('query { x }'), (err) => err.name === 'GitHubAuthError' && err.status === 401);
});

test('graphql errors → GitHubGraphQLError', async () => {
  const fetch = stubFetch(() => ({ body: JSON.stringify({ errors: [{ message: 'no' }] }) }));
  const c = createClient({ token: 'x', fetch });
  await assert.rejects(c.graphql('query { x }'), (err) => err.name === 'GitHubGraphQLError' && err.errors[0].message === 'no');
});

test('200 with data and no errors returns data', async () => {
  const fetch = stubFetch(() => ({ body: JSON.stringify({ data: { x: 1 } }) }));
  const c = createClient({ token: 'x', fetch });
  assert.deepEqual(await c.graphql('query { x }'), { x: 1 });
});

test('404 throws GitHubHTTPError, not GitHubGraphQLError', async () => {
  const fetch = stubFetch(() => ({ status: 404, body: JSON.stringify({ message: 'Not found' }) }));
  const c = createClient({ token: 'x', fetch });
  await assert.rejects(c.rest('GET', '/x'), (err) => err.name === 'GitHubHTTPError' && err.status === 404);
});

test('user-agent header set', async () => {
  const fetch = stubFetch(() => ({ body: JSON.stringify({ data: {} }) }));
  const c = createClient({ token: 'x', fetch });
  await c.graphql('query{}');
  assert.match(fetch.calls[0].init.headers['user-agent'], /mta-github-projects\/\d+\.\d+\.\d+/);
});
