// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MemoryStorage } from './memory.js';

describe('MemoryStorage edge cases', () => {
  it('has() returns true for live entries', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('k', 'v', 1000);
    expect(await s.has('k')).toBe(true);
    await s.close();
  });

  it('has() returns false for missing entries', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    expect(await s.has('missing')).toBe(false);
    await s.close();
  });

  it('has() returns false for expired entries (and cleans them up)', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('k', 'v', 5);
    await new Promise((r) => setTimeout(r, 20));
    expect(await s.has('k')).toBe(false);
    await s.close();
  });

  it('delete() returns false for missing keys', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    expect(await s.delete('missing')).toBe(false);
    await s.close();
  });

  it('clear() empties the store + resets stats (preserving evictions)', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('a', '1', 1000);
    await s.set('b', '2', 1000);
    await s.delete('a'); // evictions += 1
    await s.clear();
    expect(await s.keys()).toEqual([]);
    expect(s.stats().size).toBe(0);
    expect(s.stats().hits).toBe(0);
    expect(s.stats().misses).toBe(0);
    expect(s.stats().evictions).toBeGreaterThanOrEqual(1);
    await s.close();
  });

  it('keys() returns all current keys', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('a', '1', 1000);
    await s.set('b', '2', 1000);
    expect((await s.keys()).sort()).toEqual(['a', 'b']);
    await s.close();
  });

  it('cleanup interval purges expired entries on tick', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 5 });
    await s.set('k', 'v', 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(await s.keys()).not.toContain('k');
    await s.close();
  });

  it('TTL=0 → entry never expires (expiresAt=0)', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('k', 'v', 0);
    await new Promise((r) => setTimeout(r, 10));
    const got = await s.get('k');
    expect(got?.value).toBe('v');
    await s.close();
  });

  it('overwriting existing key does not trigger eviction at maxEntries', async () => {
    const s = new MemoryStorage<string>({ maxEntries: 1, cleanupInterval: 0 });
    await s.set('k', 'a', 1000);
    await s.set('k', 'b', 1000);
    expect((await s.get('k'))?.value).toBe('b');
    await s.close();
  });

  it('stats hits/misses tracked correctly', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('k', 'v', 1000);
    await s.get('k'); // hit
    await s.get('k'); // hit
    await s.get('missing'); // miss
    const stats = s.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    await s.close();
  });

  it('close is idempotent', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 5 });
    await s.close();
    await expect(s.close()).resolves.toBeUndefined();
  });

  it('deletePattern with no matches returns 0', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('a', '1', 1000);
    expect(await s.deletePattern('z*')).toBe(0);
    await s.close();
  });

  it('deletePattern handles wildcard ? (single char)', async () => {
    const s = new MemoryStorage<string>({ cleanupInterval: 0 });
    await s.set('a1', '1', 1000);
    await s.set('a2', '2', 1000);
    await s.set('aXY', '3', 1000);
    const count = await s.deletePattern('a?');
    expect(count).toBe(2);
    await s.close();
  });
});
