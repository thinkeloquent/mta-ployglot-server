// @ts-nocheck
import type { Response } from '../../models/response.js';
import type { RequestOptions } from '../../client/options.js';
import { CacheManager } from '../core/cache-manager.js';
import type { CacheConfig, CacheStorage } from '../types.js';
import { MemoryStorage } from '../storage/memory.js';

export type FetchFunction = (
  method: string,
  url: string | URL,
  options?: RequestOptions,
) => Promise<Response>;

export type SimpleFetchFunction = (
  url: string | URL,
  options?: RequestOptions,
) => Promise<Response>;

export interface WithCacheOptions extends CacheConfig {}

export function withCache(
  fetchFn: FetchFunction,
  config?: WithCacheOptions,
): FetchFunction & { cache: CacheManager } {
  const manager = new CacheManager(config);
  const wrapped: FetchFunction = async (method, url, options) => {
    if (!manager.shouldCache(method)) return fetchFn(method, url, options);
    const key = manager.generateKey(
      method,
      url,
      options?.headers as Record<string, string | string[]> | undefined,
      options?.body,
      options?.params as Record<string, unknown> | undefined,
    );
    return manager.getOrFetch(key, () => fetchFn(method, url, options));
  };
  return Object.assign(wrapped, { cache: manager });
}

export function withCacheSimple(
  fetchFn: SimpleFetchFunction,
  config?: WithCacheOptions,
): SimpleFetchFunction & { cache: CacheManager } {
  const manager = new CacheManager(config);
  const wrapped: SimpleFetchFunction = async (url, options) => {
    const key = manager.generateKey(
      'GET',
      url,
      options?.headers as Record<string, string | string[]> | undefined,
      options?.body,
      options?.params as Record<string, unknown> | undefined,
    );
    return manager.getOrFetch(key, () => fetchFn(url, options));
  };
  return Object.assign(wrapped, { cache: manager });
}

export interface CachedFunctionOptions<R> {
  keyFn: (...args: unknown[]) => string;
  ttl?: number;
  storage?: CacheStorage<R>;
}

export function createCachedFunction<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  options: { keyFn: (...args: Args) => string; ttl?: number; storage?: CacheStorage<R> },
): ((...args: Args) => Promise<R>) & { cache: CacheStorage<R> } {
  const storage = options.storage ?? new MemoryStorage<R>();
  const ttl = options.ttl ?? 60_000;
  const wrapped = async (...args: Args): Promise<R> => {
    const key = options.keyFn(...args);
    const cached = await storage.get(key);
    if (cached) return cached.value;
    const result = await fn(...args);
    await storage.set(key, result, ttl);
    return result;
  };
  return Object.assign(wrapped, { cache: storage });
}

export function cached(config?: WithCacheOptions) {
  const manager = new CacheManager(config);
  return function <T extends object>(
    _target: T,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<Response>>,
  ): TypedPropertyDescriptor<(...args: unknown[]) => Promise<Response>> {
    const original = descriptor.value!;
    descriptor.value = async function (this: T, ...args: unknown[]): Promise<Response> {
      const key = JSON.stringify({ name: String(propertyKey), args });
      const entry = await manager.get(key);
      if (entry) return manager.createResponseFromCache(entry);
      const response = await original.apply(this, args);
      if (response.ok) await manager.set(key, response);
      return response;
    };
    return descriptor;
  };
}
