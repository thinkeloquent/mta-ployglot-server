// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { withCache, withCacheSimple, createCachedFunction, cached } from './with-cache.js';
import { Response } from '../../models/response.js';

const okResponse = (body = 'ok'): Response =>
  new Response({ statusCode: 200, body: Buffer.from(body) });
const errResponse = (): Response => new Response({ statusCode: 500, body: Buffer.from('') });

describe('withCache (verb-shaped fetch fn)', () => {
  it('caches identical GETs', async () => {
    let calls = 0;
    const wrapped = withCache(async () => {
      calls++;
      return okResponse('a');
    });
    await wrapped('GET', 'https://x.test/p');
    await wrapped('GET', 'https://x.test/p');
    expect(calls).toBe(1);
    expect(wrapped.cache).toBeDefined();
  });

  it('different URLs → different cache entries', async () => {
    let calls = 0;
    const wrapped = withCache(async () => {
      calls++;
      return okResponse();
    });
    await wrapped('GET', 'https://x.test/a');
    await wrapped('GET', 'https://x.test/b');
    expect(calls).toBe(2);
  });

  it('non-GET methods bypass cache', async () => {
    let calls = 0;
    const wrapped = withCache(async () => {
      calls++;
      return okResponse();
    });
    await wrapped('POST', 'https://x.test/p');
    await wrapped('POST', 'https://x.test/p');
    expect(calls).toBe(2);
  });

  it('failed responses (non-2xx) NOT cached', async () => {
    let calls = 0;
    const wrapped = withCache(async () => {
      calls++;
      return errResponse();
    });
    await wrapped('GET', 'https://x.test/x');
    await wrapped('GET', 'https://x.test/x');
    expect(calls).toBe(2);
  });
});

describe('withCacheSimple (url-shaped fetch fn)', () => {
  it('caches by URL', async () => {
    let calls = 0;
    const wrapped = withCacheSimple(async () => {
      calls++;
      return okResponse();
    });
    await wrapped('https://x.test/p');
    await wrapped('https://x.test/p');
    expect(calls).toBe(1);
    expect(wrapped.cache).toBeDefined();
  });

  it('cache exposes stats', async () => {
    const wrapped = withCacheSimple(async () => okResponse());
    await wrapped('https://x.test/a');
    await wrapped('https://x.test/a');
    expect(wrapped.cache.stats().size).toBeGreaterThanOrEqual(1);
  });
});

describe('createCachedFunction (generic memoiser)', () => {
  it('memoises by computed key', async () => {
    let calls = 0;
    const expensive = async (n: number): Promise<number> => {
      calls++;
      return n * 2;
    };
    const cachedFn = createCachedFunction(expensive, {
      keyFn: (n) => `n=${n}`,
      ttl: 60_000,
    });
    expect(await cachedFn(5)).toBe(10);
    expect(await cachedFn(5)).toBe(10);
    expect(calls).toBe(1);
  });

  it('different args → different calls', async () => {
    let calls = 0;
    const fn = createCachedFunction(
      async (n: number) => {
        calls++;
        return n + 1;
      },
      { keyFn: (n) => String(n) },
    );
    await fn(1);
    await fn(2);
    expect(calls).toBe(2);
  });

  it('cache accessor exposes underlying storage', () => {
    const fn = createCachedFunction(async (n: number) => n, { keyFn: String });
    expect(fn.cache).toBeDefined();
  });
});

describe('@cached method decorator', () => {
  it('memoises method calls per arg set', async () => {
    let calls = 0;
    class Service {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: any;
      constructor() {
        // Apply decorator manually to avoid tsconfig coupling in this test.
        const decorator = cached();
        const original = async (id: number): Promise<Response> => {
          calls++;
          return new Response({ statusCode: 200, body: Buffer.from(String(id)) });
        };
        const descriptor = { value: original } as TypedPropertyDescriptor<
          (...args: unknown[]) => Promise<Response>
        >;
        const result = decorator(this as object, 'fetch', descriptor) as
          | TypedPropertyDescriptor<(...args: unknown[]) => Promise<Response>>
          | undefined;
        this.fetch = (result ?? descriptor).value!;
      }
    }
    const svc = new Service();
    await svc.fetch(1);
    await svc.fetch(1);
    expect(calls).toBe(1);
    await svc.fetch(2);
    expect(calls).toBe(2);
  });

  it('decorator passes through error responses (no caching)', async () => {
    let calls = 0;
    const decorator = cached();
    const original = async (): Promise<Response> => {
      calls++;
      return errResponse();
    };
    const descriptor = { value: original } as TypedPropertyDescriptor<
      (...args: unknown[]) => Promise<Response>
    >;
    decorator({} as object, 'm', descriptor);
    await descriptor.value!();
    await descriptor.value!();
    expect(calls).toBe(2);
  });
});
