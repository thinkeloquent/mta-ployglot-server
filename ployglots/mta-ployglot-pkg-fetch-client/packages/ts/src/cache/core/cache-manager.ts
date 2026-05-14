// @ts-nocheck
import logger, { type Logger } from '../../logger.js';
import { Response } from '../../models/response.js';
import { Headers } from '../../models/headers.js';
import { MemoryStorage } from '../storage/memory.js';
import { defaultKeyStrategy } from './key-strategy.js';
import type {
  CacheConfig,
  CacheEntry,
  CacheKeyStrategy,
  CacheStats,
  CacheStorage,
  RequestCacheOptions,
} from '../types.js';

interface CachedResponseShape {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string; // base64
}

const DEFAULT_TTL = 60_000;
const DEFAULT_METHODS = ['GET'];

export class CacheManager {
  private readonly _ttl: number;
  private readonly _storage: CacheStorage<unknown>;
  private readonly _keyStrategy: CacheKeyStrategy;
  private readonly _methods: string[];
  private readonly _staleWhileRevalidate: boolean;
  readonly staleGracePeriod: number;
  readonly logger: Logger;
  private _pending: Map<string, Promise<Response>> = new Map();

  constructor(config: CacheConfig = {}) {
    this._ttl = config.ttl ?? DEFAULT_TTL;
    this._storage = config.storage ?? (new MemoryStorage<unknown>() as CacheStorage<unknown>);
    this._keyStrategy = config.keyStrategy ?? defaultKeyStrategy;
    this._methods = config.methods ?? DEFAULT_METHODS;
    this._staleWhileRevalidate = config.staleWhileRevalidate ?? false;
    this.staleGracePeriod = config.staleGracePeriod ?? 0;
    this.logger =
      config.logger ?? logger.create('@polyglot/fetch-http-client', 'cache/core/cache-manager.ts');
  }

  generateKey(
    method: string,
    url: string | URL,
    headers?: Record<string, string | string[]>,
    body?: unknown,
    params?: Record<string, unknown>,
  ): string {
    return this._keyStrategy(method, url, headers, body, params);
  }

  shouldCache(method: string, options?: RequestCacheOptions): boolean {
    return this._methods.includes(method.toUpperCase()) && !options?.noCache;
  }

  async get(key: string): Promise<CacheEntry<unknown> | undefined> {
    return this._storage.get(key);
  }

  async getStale(key: string): Promise<CacheEntry<unknown> | undefined> {
    const direct = await this._storage.get(key);
    if (direct) return direct;
    if (!this._staleWhileRevalidate) return undefined;
    return undefined;
  }

  async set(key: string, response: Response, ttl?: number): Promise<void> {
    const bytes = await response.bytes();
    const serialized: CachedResponseShape = {
      statusCode: response.statusCode,
      headers: response.headers.toObject(),
      body: Buffer.from(bytes).toString('base64'),
    };
    await this._storage.set(key, serialized, ttl ?? this._ttl);
  }

  createResponseFromCache(entry: CacheEntry<unknown>): Response {
    const v = entry.value as CachedResponseShape;
    const body = Buffer.from(v.body, 'base64');
    return new Response({ statusCode: v.statusCode, headers: v.headers, body });
  }

  async getOrFetch(key: string, fetchFn: () => Promise<Response>): Promise<Response> {
    const cached = await this.get(key);
    if (cached) return this.createResponseFromCache(cached);

    const inflight = this._pending.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      try {
        const response = await fetchFn();
        if (response.ok) await this.set(key, response);
        return response;
      } finally {
        this._pending.delete(key);
      }
    })();
    this._pending.set(key, promise);
    return promise;
  }

  async invalidate(key: string): Promise<boolean> {
    return this._storage.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    return this._storage.deletePattern(pattern);
  }

  async clear(): Promise<void> {
    return this._storage.clear();
  }

  async keys(): Promise<string[]> {
    return this._storage.keys();
  }

  stats(): CacheStats {
    return this._storage.stats();
  }

  async close(): Promise<void> {
    await this._storage.close();
  }

  get staleWhileRevalidateEnabled(): boolean {
    return this._staleWhileRevalidate;
  }
}

export type { Headers };
