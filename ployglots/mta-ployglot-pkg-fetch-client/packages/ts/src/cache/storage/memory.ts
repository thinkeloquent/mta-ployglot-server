// @ts-nocheck
import logger, { type Logger } from '../../logger.js';
import type { CacheEntry, CacheStats, CacheStorage } from '../types.js';

export interface MemoryStorageOptions {
  maxEntries?: number;
  cleanupInterval?: number;
  logger?: Logger;
}

const DEFAULT_CLEANUP = 60_000;

export class MemoryStorage<T> implements CacheStorage<T> {
  private _entries: Map<string, CacheEntry<T>> = new Map();
  private _stats: CacheStats = { size: 0, hits: 0, misses: 0, evictions: 0 };
  private _cleanupInterval: NodeJS.Timeout | null = null;
  private readonly _maxEntries: number;
  private readonly _logger: Logger;

  constructor(options: MemoryStorageOptions = {}) {
    this._maxEntries = options.maxEntries ?? Number.POSITIVE_INFINITY;
    this._logger =
      options.logger ?? logger.create('@polyglot/fetch-http-client', 'cache/storage/memory.ts');
    const interval = options.cleanupInterval ?? DEFAULT_CLEANUP;
    if (interval > 0) {
      this._cleanupInterval = setInterval(() => this._cleanup(), interval);
      this._cleanupInterval.unref?.();
    }
  }

  async get(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = this._entries.get(key);
    if (!entry) {
      this._stats.misses += 1;
      return undefined;
    }
    if (entry.metadata.expiresAt > 0 && entry.metadata.expiresAt < Date.now()) {
      this._entries.delete(key);
      this._stats.evictions += 1;
      this._stats.misses += 1;
      return undefined;
    }
    entry.metadata.hits += 1;
    entry.metadata.lastAccess = Date.now();
    this._stats.hits += 1;
    return entry;
  }

  async set(key: string, value: T, ttl: number): Promise<void> {
    if (this._entries.size >= this._maxEntries && !this._entries.has(key)) {
      this._evictOldest();
    }
    const now = Date.now();
    this._entries.set(key, {
      value,
      metadata: {
        createdAt: now,
        ttl,
        expiresAt: ttl > 0 ? now + ttl : 0,
        hits: 0,
        lastAccess: now,
      },
    });
  }

  async has(key: string): Promise<boolean> {
    const entry = this._entries.get(key);
    if (!entry) return false;
    if (entry.metadata.expiresAt > 0 && entry.metadata.expiresAt < Date.now()) {
      this._entries.delete(key);
      this._stats.evictions += 1;
      return false;
    }
    return true;
  }

  async delete(key: string): Promise<boolean> {
    const ok = this._entries.delete(key);
    if (ok) this._stats.evictions += 1;
    return ok;
  }

  async deletePattern(pattern: string): Promise<number> {
    const re = this._globToRegex(pattern);
    let count = 0;
    for (const key of [...this._entries.keys()]) {
      if (re.test(key)) {
        this._entries.delete(key);
        count += 1;
      }
    }
    if (count > 0) this._stats.evictions += count;
    return count;
  }

  async clear(): Promise<void> {
    this._entries.clear();
    this._stats = { size: 0, hits: 0, misses: 0, evictions: this._stats.evictions };
  }

  async keys(): Promise<string[]> {
    return [...this._entries.keys()];
  }

  stats(): CacheStats {
    return { ...this._stats, size: this._entries.size };
  }

  async close(): Promise<void> {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this._entries.entries()) {
      if (entry.metadata.expiresAt > 0 && entry.metadata.expiresAt < now) {
        this._entries.delete(key);
        this._stats.evictions += 1;
      }
    }
  }

  private _evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this._entries.entries()) {
      if (entry.metadata.lastAccess < oldestTime) {
        oldestTime = entry.metadata.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      this._entries.delete(oldestKey);
      this._stats.evictions += 1;
      this._logger.debug('evicted', { key: oldestKey });
    }
  }

  private _globToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${re}$`);
  }
}
