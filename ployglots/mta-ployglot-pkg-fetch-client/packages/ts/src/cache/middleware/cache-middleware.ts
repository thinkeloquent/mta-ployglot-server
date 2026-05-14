// @ts-nocheck
import type { AsyncClient } from '../../client/client.js';
import type { RequestOptions } from '../../client/options.js';
import type { Request } from '../../models/request.js';
import type { Response } from '../../models/response.js';
import type { RequestHook, ResponseHook } from '../../interceptors/hooks.js';
import { CacheManager } from '../core/cache-manager.js';
import type { CacheConfig, RequestCacheOptions } from '../types.js';

export type CacheMiddlewareOptions = CacheConfig;

export interface CacheHooks {
  cacheManager: CacheManager;
  requestHook: RequestHook;
  responseHook: ResponseHook;
}

export function createCacheHooks(options?: CacheMiddlewareOptions): CacheHooks {
  const cacheManager = new CacheManager(options);

  const requestHook: RequestHook = async (_request: Request) => {
    // No-op at request time. Provided so consumers can plug us into eventHooks
    // without any short-circuit; caching here happens on the response side.
  };

  const responseHook: ResponseHook = async (response: Response) => {
    if (!response.ok) return;
    if (!response.request) return;
    const method = response.request.method;
    if (!cacheManager.shouldCache(method)) return;
    const key = cacheManager.generateKey(method, response.request.urlString);
    try {
      await cacheManager.set(key, response);
    } catch {
      /* swallow — cache failure should not break the request path */
    }
  };

  return { cacheManager, requestHook, responseHook };
}

export interface CacheAwareClient {
  cacheManager: CacheManager;
  makeRequest(
    method: string,
    url: string | URL,
    options?: RequestOptions & { cache?: RequestCacheOptions },
  ): Promise<Response>;
  get(
    url: string | URL,
    options?: RequestOptions & { cache?: RequestCacheOptions },
  ): Promise<Response>;
  post(
    url: string | URL,
    options?: RequestOptions & { cache?: RequestCacheOptions },
  ): Promise<Response>;
  put(
    url: string | URL,
    options?: RequestOptions & { cache?: RequestCacheOptions },
  ): Promise<Response>;
  patch(
    url: string | URL,
    options?: RequestOptions & { cache?: RequestCacheOptions },
  ): Promise<Response>;
  delete(
    url: string | URL,
    options?: RequestOptions & { cache?: RequestCacheOptions },
  ): Promise<Response>;
}

export function createCacheAwareClient(
  client: AsyncClient,
  options?: CacheMiddlewareOptions,
): CacheAwareClient {
  const cacheManager = new CacheManager(options);

  async function makeRequest(
    method: string,
    url: string | URL,
    options: RequestOptions & { cache?: RequestCacheOptions } = {},
  ): Promise<Response> {
    const cacheOpts = options.cache;
    if (!cacheManager.shouldCache(method, cacheOpts)) {
      return client.request(method, url, options);
    }
    const key =
      cacheOpts?.cacheKey ??
      cacheManager.generateKey(
        method,
        url,
        options.headers as Record<string, string | string[]> | undefined,
        options.body,
        options.params as Record<string, unknown> | undefined,
      );

    if (!cacheOpts?.forceRefresh) {
      const entry = await cacheManager.get(key);
      if (entry) return cacheManager.createResponseFromCache(entry);
    }

    const response = await client.request(method, url, options);
    if (response.ok) {
      await cacheManager.set(key, response, cacheOpts?.ttl);
      const entry = await cacheManager.get(key);
      if (entry) return cacheManager.createResponseFromCache(entry);
    }
    return response;
  }

  return {
    cacheManager,
    makeRequest,
    get: (url, opts) => makeRequest('GET', url, opts),
    post: (url, opts) => makeRequest('POST', url, opts),
    put: (url, opts) => makeRequest('PUT', url, opts),
    patch: (url, opts) => makeRequest('PATCH', url, opts),
    delete: (url, opts) => makeRequest('DELETE', url, opts),
  };
}
