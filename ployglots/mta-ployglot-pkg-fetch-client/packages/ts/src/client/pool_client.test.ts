// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Pool, BalancedPool, MockAgent } from 'undici';
import {
  AsyncClientPool,
  PoolType,
  RoundRobinPool,
  createPool,
  createBalancedPool,
  createRoundRobinPool,
  normalizePoolType,
} from './pool_client.js';

describe('normalizePoolType', () => {
  it('default → POOL', () => {
    expect(normalizePoolType()).toBe(PoolType.POOL);
    expect(normalizePoolType(undefined)).toBe(PoolType.POOL);
  });
  it('balanced', () => {
    expect(normalizePoolType('balanced')).toBe(PoolType.BALANCED);
    expect(normalizePoolType('BALANCED')).toBe(PoolType.BALANCED);
  });
  it('round-robin / rr', () => {
    expect(normalizePoolType('round-robin')).toBe(PoolType.ROUND_ROBIN);
    expect(normalizePoolType('rr')).toBe(PoolType.ROUND_ROBIN);
    expect(normalizePoolType('RR')).toBe(PoolType.ROUND_ROBIN);
  });
  it('pool', () => {
    expect(normalizePoolType('pool')).toBe(PoolType.POOL);
    expect(normalizePoolType(PoolType.POOL)).toBe(PoolType.POOL);
  });
  it('unknown → POOL fallback', () => {
    expect(normalizePoolType('garbage')).toBe(PoolType.POOL);
  });
});

describe('AsyncClientPool', () => {
  it('no pool config → no pool created', async () => {
    const c = new AsyncClientPool({});
    expect(c.pool).toBeNull();
    expect(c.poolType).toBe(PoolType.POOL);
    expect(c.upstreams).toBeNull();
    await c.close();
  });

  it('single origin (string) → Pool', async () => {
    const c = new AsyncClientPool({ pool: { origins: 'https://x.test' } });
    expect(c.pool).toBeInstanceOf(Pool);
    expect(c.poolType).toBe(PoolType.POOL);
    expect(c.upstreams).toEqual(['https://x.test']);
    await c.close();
  });

  it('single origin (array of one) → Pool', async () => {
    const c = new AsyncClientPool({ pool: { origins: ['https://x.test'] } });
    expect(c.pool).toBeInstanceOf(Pool);
    await c.close();
  });

  it('multiple origins → BalancedPool regardless of type', async () => {
    const c = new AsyncClientPool({
      pool: { origins: ['https://a.test', 'https://b.test'], type: 'pool' },
    });
    expect(c.pool).toBeInstanceOf(BalancedPool);
    expect(c.poolType).toBe(PoolType.BALANCED);
    await c.close();
  });

  it('explicit type=balanced with one origin still uses BalancedPool', async () => {
    const c = new AsyncClientPool({
      pool: { origins: ['https://x.test'], type: 'balanced' },
    });
    expect(c.pool).toBeInstanceOf(BalancedPool);
    await c.close();
  });

  it('type=round-robin with single origin', async () => {
    const c = new AsyncClientPool({
      pool: { origins: 'https://x.test', type: 'round-robin' },
    });
    expect(c.poolType).toBe(PoolType.ROUND_ROBIN);
    await c.close();
  });

  it('empty origins array → no pool', async () => {
    const c = new AsyncClientPool({ pool: { origins: [] } });
    expect(c.pool).toBeNull();
    await c.close();
  });

  it('pool options flow through', async () => {
    const c = new AsyncClientPool({
      pool: {
        origins: 'https://x.test',
        connections: 5,
        keepAliveTimeout: 1000,
        pipelining: 2,
        bodyTimeout: 5000,
        headersTimeout: 5000,
        allowH2: false,
      },
    });
    expect(c.pool).toBeInstanceOf(Pool);
    await c.close();
  });

  it('mounts get wrapped so client.close does NOT kill them', async () => {
    let closeCount = 0;
    const fakeMount = {
      dispatch: () => true,
      close: async () => {
        closeCount++;
      },
      destroy: async () => {},
    };
    const c = new AsyncClientPool({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mounts: { 'https://api.test': fakeMount as any },
    });
    await c.close();
    // Mount close count remains 0 because NoCloseDispatcher is no-op.
    expect(closeCount).toBe(0);
  });

  it('addUpstream extends balanced pool', async () => {
    const c = new AsyncClientPool({
      pool: { origins: ['https://a.test', 'https://b.test'] },
    });
    c.addUpstream('https://c.test');
    expect(c.upstreams).toEqual(['https://a.test', 'https://b.test', 'https://c.test']);
    await c.close();
  });

  it('removeUpstream drops one entry', async () => {
    const c = new AsyncClientPool({
      pool: { origins: ['https://a.test', 'https://b.test'] },
    });
    c.removeUpstream('https://a.test');
    expect(c.upstreams).toEqual(['https://b.test']);
    await c.close();
  });

  it('addUpstream accepts URL', async () => {
    const c = new AsyncClientPool({
      pool: { origins: ['https://a.test', 'https://b.test'] },
    });
    c.addUpstream(new URL('https://c.test'));
    expect(c.upstreams).toContain('https://c.test');
    await c.close();
  });

  it('stats accessor returns null when no pool', async () => {
    const c = new AsyncClientPool({});
    expect(c.stats).toBeNull();
    await c.close();
  });

  it('stats accessor returns object when pool present', async () => {
    const c = new AsyncClientPool({ pool: { origins: 'https://x.test' } });
    expect(c.stats).not.toBeNull();
    await c.close();
  });

  it('close() is safe to call twice', async () => {
    const c = new AsyncClientPool({ pool: { origins: 'https://x.test' } });
    await c.close();
    await expect(c.close()).resolves.toBeUndefined();
  });

  it('routes requests through mocked dispatcher when mounted', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get('http://example.com').intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const c = new AsyncClientPool({ mounts: { 'http://example.com': mock } });
    try {
      const resp = await c.get('http://example.com/x');
      expect(resp.statusCode).toBe(200);
    } finally {
      await c.close();
      // Mock not closed by c.close() → must close explicitly. Because of NoCloseDispatcher
      // the inner client.close() left it alive.
      await mock.close();
    }
  });
});

describe('standalone pool factories', () => {
  it('createPool returns Pool', async () => {
    const p = createPool('https://x.test');
    expect(p).toBeInstanceOf(Pool);
    await p.close();
  });

  it('createPool accepts URL', async () => {
    const p = createPool(new URL('https://x.test'));
    expect(p).toBeInstanceOf(Pool);
    await p.close();
  });

  it('createBalancedPool with two origins', async () => {
    const p = createBalancedPool(['https://a.test', 'https://b.test']);
    expect(p).toBeInstanceOf(BalancedPool);
    await p.close();
  });

  it('createBalancedPool accepts URL elements', async () => {
    const p = createBalancedPool([new URL('https://a.test'), 'https://b.test']);
    expect(p).toBeInstanceOf(BalancedPool);
    await p.close();
  });

  it('createRoundRobinPool returns the configured class', async () => {
    const p = createRoundRobinPool('https://x.test');
    expect(p).toBeInstanceOf(RoundRobinPool);
    await p.close();
  });

  it('createRoundRobinPool accepts URL', async () => {
    const p = createRoundRobinPool(new URL('https://x.test'));
    await p.close();
  });
});
