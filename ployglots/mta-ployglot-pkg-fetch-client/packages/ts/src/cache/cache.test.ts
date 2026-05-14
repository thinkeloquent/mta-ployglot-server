// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MemoryStorage } from './storage/memory.js';
import { CacheManager } from './core/cache-manager.js';
import { Response } from '../models/response.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('MemoryStorage', () => {
  it('set + get round-trip', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('k', 'v', 1000);
    const got = await s.get('k');
    expect(got?.value).toBe('v');
    await s.close();
  });

  it('expires after TTL', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('k', 'v', 5);
    await sleep(20);
    expect(await s.get('k')).toBeUndefined();
    await s.close();
  });

  it('LRU eviction at maxEntries', async () => {
    const s = new MemoryStorage<string>({ maxEntries: 2, cleanupInterval: 0 });
    await s.set('a', '1', 5000);
    await sleep(2);
    await s.set('b', '2', 5000);
    await sleep(2);
    await s.set('c', '3', 5000);
    expect(await s.get('a')).toBeUndefined();
    expect((await s.get('b'))?.value).toBe('2');
    expect((await s.get('c'))?.value).toBe('3');
    await s.close();
  });

  it('deletePattern matches glob', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('user:1', 'a', 5000);
    await s.set('user:2', 'b', 5000);
    await s.set('post:1', 'c', 5000);
    const deleted = await s.deletePattern('user:*');
    expect(deleted).toBe(2);
    expect(await s.get('post:1')).toBeDefined();
    await s.close();
  });
});

describe('CacheManager', () => {
  it('shouldCache: GET yes, POST no', () => {
    const m = new CacheManager();
    expect(m.shouldCache('GET')).toBe(true);
    expect(m.shouldCache('POST')).toBe(false);
  });

  it('roundtrip: set + get + createResponseFromCache preserves body', async () => {
    const m = new CacheManager({ ttl: 5000 });
    const original = new Response({
      statusCode: 200,
      body: Buffer.from('hello'),
      headers: { 'content-type': 'text/plain' },
    });
    await m.set('k', original);
    const entry = await m.get('k');
    expect(entry).toBeDefined();
    const recovered = m.createResponseFromCache(entry!);
    expect(await recovered.text()).toBe('hello');
    await m.close();
  });

  it('getOrFetch dedups concurrent calls', async () => {
    const m = new CacheManager({ ttl: 5000 });
    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      await sleep(20);
      return new Response({ statusCode: 200, body: Buffer.from('x') });
    };
    await Promise.all([
      m.getOrFetch('key', fetchFn),
      m.getOrFetch('key', fetchFn),
      m.getOrFetch('key', fetchFn),
      m.getOrFetch('key', fetchFn),
      m.getOrFetch('key', fetchFn),
    ]);
    expect(callCount).toBe(1);
    await m.close();
  });

  it('invalidate returns true once', async () => {
    const m = new CacheManager({ ttl: 5000 });
    await m.set('k', new Response({ statusCode: 200, body: Buffer.from('v') }));
    expect(await m.invalidate('k')).toBe(true);
    expect(await m.invalidate('k')).toBe(false);
    await m.close();
  });
});
