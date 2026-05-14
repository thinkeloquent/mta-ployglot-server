// @ts-nocheck
import { AsyncClient } from '../../client/client.js';
import type { AsyncClientOptions, RequestOptions } from '../../client/options.js';
import type { Response } from '../../models/response.js';
import { CacheManager } from '../core/cache-manager.js';
import type { CacheConfig, RequestCacheOptions } from '../types.js';

export interface CachingClientOptions extends AsyncClientOptions {
  cache?: CacheConfig;
}

export interface CachingRequestOptions extends RequestOptions {
  cache?: RequestCacheOptions;
}

export class CachingClient {
  private readonly _client: AsyncClient;
  private readonly _cacheManager: CacheManager;

  constructor(options: CachingClientOptions = {}) {
    const { cache, ...rest } = options;
    this._client = new AsyncClient(rest);
    this._cacheManager = new CacheManager(cache);
  }

  get cache(): CacheManager {
    return this._cacheManager;
  }
  get client(): AsyncClient {
    return this._client;
  }

  async request(
    method: string,
    url: string | URL,
    options: CachingRequestOptions = {},
  ): Promise<Response> {
    const cacheOpts = options.cache;
    if (!this._cacheManager.shouldCache(method, cacheOpts)) {
      return this._client.request(method, url, options);
    }
    const headers =
      options.headers && typeof options.headers === 'object'
        ? (options.headers as Record<string, string | string[]>)
        : undefined;
    const params = options.params as Record<string, unknown> | undefined;
    const key =
      cacheOpts?.cacheKey ??
      this._cacheManager.generateKey(method, url, headers, options.body, params);

    if (!cacheOpts?.forceRefresh) {
      const entry = await this._cacheManager.get(key);
      if (entry) return this._cacheManager.createResponseFromCache(entry);
    }

    const response = await this._client.request(method, url, options);
    if (response.ok) {
      await this._cacheManager.set(key, response, cacheOpts?.ttl);
      // set() consumes the body; rehydrate from cache so the caller can still read it.
      const entry = await this._cacheManager.get(key);
      if (entry) return this._cacheManager.createResponseFromCache(entry);
    }
    return response;
  }

  async get(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('GET', url, options);
  }
  async post(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('POST', url, options);
  }
  async put(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('PUT', url, options);
  }
  async patch(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('PATCH', url, options);
  }
  async delete(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('DELETE', url, options);
  }
  async head(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('HEAD', url, options);
  }
  async options(url: string | URL, options?: CachingRequestOptions): Promise<Response> {
    return this.request('OPTIONS', url, options);
  }

  async close(): Promise<void> {
    await this._cacheManager.close();
    await this._client.close();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
