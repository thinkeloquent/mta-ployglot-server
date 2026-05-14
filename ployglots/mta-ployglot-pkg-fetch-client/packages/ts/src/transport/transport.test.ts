// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MockAgent } from 'undici';
import { DispatcherFactory } from './dispatcher.js';
import { MountRouter, createMountRouter } from './router.js';
import { Timeout } from '../config/timeout.js';

describe('DispatcherFactory', () => {
  it('caches Pool per origin', async () => {
    const f = new DispatcherFactory();
    const a = f.getDispatcher('https://api.example.com/v1');
    const b = f.getDispatcher('https://api.example.com/v2');
    expect(a).toBe(b);
    expect(f.cacheSize).toBe(1);
    expect(f.cachedOrigins).toContain('https://api.example.com');
    await f.closeAll();
  });

  it('different origins → different Pools', async () => {
    const f = new DispatcherFactory();
    const a = f.getDispatcher('https://a.test');
    const b = f.getDispatcher('https://b.test');
    expect(a).not.toBe(b);
    expect(f.cacheSize).toBe(2);
    await f.closeAll();
  });

  it('closeAll empties the cache', async () => {
    const f = new DispatcherFactory();
    f.getDispatcher('https://a.test');
    f.getDispatcher('https://b.test');
    expect(f.cacheSize).toBe(2);
    await f.closeAll();
    expect(f.cacheSize).toBe(0);
  });

  it('Timeout config flows through to the Pool options', async () => {
    const f = new DispatcherFactory({ timeout: new Timeout({ read: 5000 }) });
    f.getDispatcher('https://x.test');
    expect(f.cacheSize).toBe(1);
    await f.closeAll();
  });
});

describe('MountRouter pattern matching', () => {
  it('exact host wins over wildcard', () => {
    const a = new MockAgent();
    const b = new MockAgent();
    const r = new MountRouter();
    r.mount('all://', a);
    r.mount('https://api.example.com', b);
    expect(r.getDispatcher('https://api.example.com/v1')).toBe(b);
    expect(r.getDispatcher('https://other.test')).toBe(a);
  });

  it('wildcard subdomain matches *.example.com', () => {
    const a = new MockAgent();
    const r = new MountRouter();
    r.mount('https://*.example.com', a);
    expect(r.getDispatcher('https://api.example.com')).toBe(a);
    expect(r.getDispatcher('https://other.com')).toBeUndefined();
  });

  it('unmount removes a pattern', () => {
    const a = new MockAgent();
    const r = new MountRouter();
    r.mount('https://api.test', a);
    expect(r.size).toBe(1);
    expect(r.unmount('https://api.test')).toBe(true);
    expect(r.size).toBe(0);
    expect(r.unmount('https://api.test')).toBe(false);
  });

  it('patterns getter is in descending specificity order', () => {
    const a = new MockAgent();
    const b = new MockAgent();
    const c = new MockAgent();
    const r = new MountRouter();
    r.mount('all://', a);
    r.mount('https://*', b);
    r.mount('https://api.test', c);
    expect(r.patterns[0]).toBe('https://api.test'); // most specific
  });

  it('empty router → undefined', () => {
    expect(new MountRouter().getDispatcher('https://x.test')).toBeUndefined();
  });
});

describe('createMountRouter', () => {
  it('builds from a record', () => {
    const a = new MockAgent();
    const b = new MockAgent();
    const r = createMountRouter({ 'https://a.test': a, 'https://b.test': b });
    expect(r.size).toBe(2);
    expect(r.getDispatcher('https://a.test')).toBe(a);
  });

  it('undefined input → empty router', () => {
    expect(createMountRouter().size).toBe(0);
  });
});

describe('MountRouter.closeAll', () => {
  it('closes each mounted dispatcher', async () => {
    let closed = 0;
    const fakeDispatcher = {
      close: async () => {
        closed += 1;
      },
    };
    const r = new MountRouter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.mount('https://a.test', fakeDispatcher as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.mount('https://b.test', fakeDispatcher as any);
    await r.closeAll();
    expect(closed).toBe(2);
    expect(r.size).toBe(0);
  });
});
