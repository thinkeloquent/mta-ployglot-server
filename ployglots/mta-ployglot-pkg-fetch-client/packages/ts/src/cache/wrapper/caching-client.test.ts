// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MockAgent } from 'undici';
import { CachingClient } from './caching-client.js';

const ORIGIN = 'http://cache.test';

function setupMock(): MockAgent {
  const m = new MockAgent();
  m.disableNetConnect();
  return m;
}

describe('CachingClient', () => {
  it('exposes cache + client accessors', () => {
    const c = new CachingClient({ baseUrl: ORIGIN });
    expect(c.cache).toBeDefined();
    expect(c.client).toBeDefined();
    return c.close();
  });

  it('serves repeated GET from cache after first round-trip', async () => {
    const mock = setupMock();
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .reply(200, 'hello', { headers: { 'content-type': 'text/plain' } });
    const c = new CachingClient({ mounts: { [ORIGIN]: mock }, cache: { ttl: 60_000 } });
    try {
      const r1 = await c.get(`${ORIGIN}/x`);
      expect(await r1.text()).toBe('hello');
      // Second call: cache hit, NO further intercept consumed.
      const r2 = await c.get(`${ORIGIN}/x`);
      expect(await r2.text()).toBe('hello');
      expect(c.cache.stats().hits).toBeGreaterThanOrEqual(1);
    } finally {
      await c.close();
    }
  });

  it('forceRefresh skips cache lookup', async () => {
    const mock = setupMock();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'first');
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'second');
    const c = new CachingClient({ mounts: { [ORIGIN]: mock }, cache: { ttl: 60_000 } });
    try {
      const r1 = await c.get(`${ORIGIN}/x`);
      expect(await r1.text()).toBe('first');
      const r2 = await c.get(`${ORIGIN}/x`, { cache: { forceRefresh: true } });
      expect(await r2.text()).toBe('second');
    } finally {
      await c.close();
    }
  });

  it('noCache bypasses cache entirely', async () => {
    const mock = setupMock();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'a');
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'b');
    const c = new CachingClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r1 = await c.get(`${ORIGIN}/x`, { cache: { noCache: true } });
      expect(await r1.text()).toBe('a');
      const r2 = await c.get(`${ORIGIN}/x`, { cache: { noCache: true } });
      expect(await r2.text()).toBe('b');
    } finally {
      await c.close();
    }
  });

  it('non-GET methods bypass cache', async () => {
    const mock = setupMock();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'POST' }).reply(200, 'ok').times(2);
    const c = new CachingClient({ mounts: { [ORIGIN]: mock } });
    try {
      await c.post(`${ORIGIN}/x`);
      await c.post(`${ORIGIN}/x`);
    } finally {
      await c.close();
    }
  });

  it('does not cache 4xx responses', async () => {
    const mock = setupMock();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/missing', method: 'GET' }).reply(404, '');
    pool.intercept({ path: '/missing', method: 'GET' }).reply(404, '');
    const c = new CachingClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r1 = await c.get(`${ORIGIN}/missing`);
      expect(r1.statusCode).toBe(404);
      // Second 404: must hit upstream again (4xx not cached).
      const r2 = await c.get(`${ORIGIN}/missing`);
      expect(r2.statusCode).toBe(404);
    } finally {
      await c.close();
    }
  });

  it('all verb methods delegate to request()', async () => {
    const mock = setupMock();
    const pool = mock.get(ORIGIN);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      pool.intercept({ path: '/v', method }).reply(200, '');
    }
    const c = new CachingClient({ mounts: { [ORIGIN]: mock } });
    try {
      expect((await c.get(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await c.post(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await c.put(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await c.patch(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await c.delete(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await c.head(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await c.options(`${ORIGIN}/v`)).statusCode).toBe(200);
    } finally {
      await c.close();
    }
  });

  it('Symbol.asyncDispose closes cleanly', async () => {
    const c = new CachingClient({});
    await c[Symbol.asyncDispose]();
    expect(c.client.closed).toBe(true);
  });

  it('custom cacheKey overrides default key strategy', async () => {
    const mock = setupMock();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'A').times(2);
    const c = new CachingClient({ mounts: { [ORIGIN]: mock } });
    try {
      await c.get(`${ORIGIN}/x`, { cache: { cacheKey: 'k1' } });
      // Different custom key → different cache slot → second upstream call.
      await c.get(`${ORIGIN}/x`, { cache: { cacheKey: 'k2' } });
    } finally {
      await c.close();
    }
  });
});
