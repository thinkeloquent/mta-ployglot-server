// @ts-nocheck
import type { Logger } from '../logger.js';

export interface RequestContext {
  method: string;
  url: string | URL;
  headers?: Record<string, string | string[]>;
  body?: unknown;
  params?: Record<string, unknown>;
}

export type CacheKeyStrategy = (
  method: string,
  url: string | URL,
  headers?: Record<string, string | string[]>,
  body?: unknown,
  params?: Record<string, unknown>,
) => string;

export interface CacheEntryMetadata {
  createdAt: number;
  ttl: number;
  expiresAt: number;
  hits: number;
  lastAccess: number;
}

export interface CacheEntry<T> {
  value: T;
  metadata: CacheEntryMetadata;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

export interface CacheStorage<T> {
  get(key: string): Promise<CacheEntry<T> | undefined>;
  set(key: string, value: T, ttl: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  deletePattern(pattern: string): Promise<number>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  stats(): CacheStats;
  close(): Promise<void>;
}

export interface CacheConfig {
  ttl?: number;
  storage?: CacheStorage<unknown>;
  keyStrategy?: CacheKeyStrategy;
  methods?: string[];
  maxEntries?: number;
  staleWhileRevalidate?: boolean;
  staleGracePeriod?: number;
  logger?: Logger;
}

export interface RequestCacheOptions {
  ttl?: number;
  noCache?: boolean;
  forceRefresh?: boolean;
  cacheKey?: string;
}
