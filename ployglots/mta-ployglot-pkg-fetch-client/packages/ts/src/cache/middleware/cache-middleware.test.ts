// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MockAgent } from 'undici';
import { createCacheHooks, createCacheAwareClient } from './cache-middleware.js';
import { AsyncClient } from '../../client/client.js';
import { Request } from '../../models/request.js';
import { Response } from '../../models/response.js';

const ORIGIN = 'http://hooks.test';

describe('createCacheHooks', () => {
  it('returns {cacheManager, requestHook, responseHook}', () => {
    const h = createCacheHooks();
    expect(h.cacheManager).toBeDefined();
    expect(typeof h.requestHook).toBe('function');
    expect(typeof h.responseHook).toBe('function');
  });

  it('requestHook is a no-op (does not throw)', async () => {
    const h = createCacheHooks();
    await expect(h.requestHook(new Request('GET', 'https://x.test/'))).resolves.toBeUndefined();
  });

  it('responseHook stores OK GET responses', async () => {
    const h = createCacheHooks();
    const req = new Request('GET', 'https://x.test/p');
    const resp = new Response({ statusCode: 200, body: Buffer.from('cached'), request: req });
    await h.responseHook(resp);
    const key = h.cacheManager.generateKey('GET', req.urlString);
    const entry = await h.cacheManager.get(key);
    expect(entry).toBeDefined();
  });

  it('responseHook ignores non-2xx responses', async () => {
    const h = createCacheHooks();
    const req = new Request('GET', 'https://x.test/p');
    const resp = new Response({ statusCode: 500, request: req });
    await h.responseHook(resp);
    const key = h.cacheManager.generateKey('GET', req.urlString);
    expect(await h.cacheManager.get(key)).toBeUndefined();
  });

  it('responseHook ignores non-cacheable methods', async () => {
    const h = createCacheHooks();
    const req = new Request('POST', 'https://x.test/p');
    const resp = new Response({ statusCode: 200, request: req });
    await h.responseHook(resp);
    const key = h.cacheManager.generateKey('POST', req.urlString);
    expect(await h.cacheManager.get(key)).toBeUndefined();
  });

  it('responseHook is robust to missing request', async () => {
    const h = createCacheHooks();
    const resp = new Response({ statusCode: 200 }); // no request
    await expect(h.responseHook(resp)).resolves.toBeUndefined();
  });
});

describe('createCacheAwareClient', () => {
  it('caches GET responses across calls', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const inner = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    const aware = createCacheAwareClient(inner);
    try {
      const r1 = await aware.get(`${ORIGIN}/x`);
      expect(await r1.text()).toBe('ok');
      const r2 = await aware.get(`${ORIGIN}/x`);
      expect(await r2.text()).toBe('ok');
    } finally {
      await inner.close();
    }
  });

  it('forceRefresh ignores cache', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'first');
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'second');
    const inner = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    const aware = createCacheAwareClient(inner);
    try {
      const r1 = await aware.get(`${ORIGIN}/x`);
      expect(await r1.text()).toBe('first');
      const r2 = await aware.get(`${ORIGIN}/x`, { cache: { forceRefresh: true } });
      expect(await r2.text()).toBe('second');
    } finally {
      await inner.close();
    }
  });

  it('non-GET methods bypass cache via shouldCache=false', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'POST' }).reply(200, 'ok').times(2);
    const inner = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    const aware = createCacheAwareClient(inner);
    try {
      await aware.post(`${ORIGIN}/x`);
      await aware.post(`${ORIGIN}/x`);
    } finally {
      await inner.close();
    }
  });

  it('exposes makeRequest + verb shortcuts', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      pool.intercept({ path: '/v', method }).reply(200, '');
    }
    const inner = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    const aware = createCacheAwareClient(inner);
    try {
      expect((await aware.makeRequest('GET', `${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await aware.post(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await aware.put(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await aware.patch(`${ORIGIN}/v`)).statusCode).toBe(200);
      expect((await aware.delete(`${ORIGIN}/v`)).statusCode).toBe(200);
    } finally {
      await inner.close();
    }
  });
});
