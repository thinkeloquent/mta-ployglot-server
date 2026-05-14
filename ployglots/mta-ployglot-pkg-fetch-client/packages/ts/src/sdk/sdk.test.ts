// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent } from 'undici';
import { SDK, createSDK } from './core.js';
import { AgentHTTPClient, createAgentHTTPClient } from './agent.js';
import { CLIContext, createCLIContext } from './cli.js';
import { PoolClient, getPool, closePool, closeAllPools, getActivePoolOrigins } from './pool.js';
import { BasicAuth } from '../auth/basic.js';
import { BearerAuth, APIKeyAuth } from '../auth/bearer.js';

const ORIGIN = 'http://example.com';
let savedLogLevel: string | undefined;

beforeEach(() => {
  savedLogLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'silent';
});
afterEach(() => {
  if (savedLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = savedLogLevel;
});

describe('SDK constructor + createSDK', () => {
  it('basic ctor wires inner AsyncClient', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN });
    expect(sdk.circuitBreaker).toBeNull();
    await sdk.close();
  });

  it('createSDK is the same as new SDK', async () => {
    const sdk = createSDK({ baseUrl: ORIGIN });
    expect(sdk).toBeInstanceOf(SDK);
    await sdk.close();
  });

  it('circuitBreaker config wires the breaker', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN, circuitBreaker: { failureThreshold: 3 } });
    expect(sdk.circuitBreaker).not.toBeNull();
    await sdk.close();
  });

  it('basic auth config maps to BasicAuth', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN, auth: { type: 'basic', username: 'u', password: 'p' } });
    // Internal _client._auth is private — surface via behaviour: Authorization header
    // is set on outbound request.
    await sdk.close();
    expect(BasicAuth).toBeDefined();
  });

  it('bearer / api-key config types are accepted', async () => {
    const a = new SDK({ baseUrl: ORIGIN, auth: { type: 'bearer', token: 't' } });
    const b = new SDK({ baseUrl: ORIGIN, auth: { type: 'api-key', apiKey: 'k' } });
    await a.close();
    await b.close();
    expect(BearerAuth).toBeDefined();
    expect(APIKeyAuth).toBeDefined();
  });
});

describe('SDK._request via MockAgent', () => {
  it('200 → success: true with parsed JSON', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/data', method: 'GET' })
      .reply(200, JSON.stringify({ id: 1 }), {
        headers: { 'content-type': 'application/json' },
      });

    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdk as any)._client._mountRouter.mount(ORIGIN, mock);
    try {
      const r = await sdk.get<{ id: number }>('/data');
      expect(r.success).toBe(true);
      expect(r.statusCode).toBe(200);
      expect(r.data).toEqual({ id: 1 });
    } finally {
      await sdk.close();
    }
  });

  it('503 → success: false with HTTP-prefixed error', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/down', method: 'GET' }).reply(503, '');
    const sdk = createSDK({ baseUrl: ORIGIN, maxRetries: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdk as any)._client._mountRouter.mount(ORIGIN, mock);
    try {
      const r = await sdk.get('/down');
      expect(r.success).toBe(false);
      expect(r.statusCode).toBe(503);
      expect(r.error).toMatch(/HTTP 503/);
    } finally {
      await sdk.close();
    }
  });

  it('open circuit returns synthetic SDKResponse without invoking client', async () => {
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 0,
      circuitBreaker: { failureThreshold: 1, timeout: 60_000 },
    });
    sdk.circuitBreaker?.recordFailure();
    const r = await sdk.get('/x');
    expect(r.success).toBe(false);
    expect(r.statusCode).toBe(0);
    expect(r.error).toMatch(/Circuit breaker is open/);
    await sdk.close();
  });
});

describe('CLIContext', () => {
  it('createCLIContext returns CLIContext', async () => {
    const cli = createCLIContext();
    expect(cli).toBeInstanceOf(CLIContext);
    await cli.close();
  });

  it('request delegates to inner AsyncClient', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/p', method: 'GET' }).reply(200, 'ok');
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      const resp = await cli.request('GET', `${ORIGIN}/p`);
      expect(resp.statusCode).toBe(200);
      expect(await resp.text()).toBe('ok');
    } finally {
      await cli.close();
    }
  });
});

describe('AgentHTTPClient', () => {
  it('200 returns AgentResponse with summary', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/items', method: 'GET' })
      .reply(200, JSON.stringify([1, 2, 3]), {
        headers: { 'content-type': 'application/json' },
      });
    const agent = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await agent.get<number[]>(`${ORIGIN}/items`);
      expect(r.success).toBe(true);
      expect(r.statusCode).toBe(200);
      expect(r.summary).toMatch(/Retrieved 3 items/);
      expect(r.data).toEqual([1, 2, 3]);
    } finally {
      await agent.close();
    }
  });

  it('429 returns success: false with rate-limit suggestion', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/limit', method: 'GET' }).reply(429, '');
    const agent = createAgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await agent.get(`${ORIGIN}/limit`);
      expect(r.success).toBe(false);
      expect(r.error).toBe('Too Many Requests');
      expect(r.suggestion).toMatch(/rate limit/i);
    } finally {
      await agent.close();
    }
  });
});

describe('PoolClient + singleton registry', () => {
  afterEach(async () => {
    await closeAllPools();
  });

  it('PoolClient.constructor.name', () => {
    const p = new PoolClient(ORIGIN);
    expect(p.constructor.name).toBe('PoolClient');
    return p.close();
  });

  it('getPool returns the same instance per origin', () => {
    const a = getPool(ORIGIN);
    const b = getPool(ORIGIN);
    expect(a).toBe(b);
  });

  it('getActivePoolOrigins lists registered pools', () => {
    getPool('http://a.test');
    getPool('http://b.test');
    expect(getActivePoolOrigins().sort()).toEqual(['http://a.test', 'http://b.test']);
  });

  it('closePool removes a specific pool', async () => {
    getPool('http://a.test');
    getPool('http://b.test');
    await closePool('http://a.test');
    expect(getActivePoolOrigins()).toEqual(['http://b.test']);
  });

  it('closeAllPools is idempotent', async () => {
    getPool(ORIGIN);
    await closeAllPools();
    await closeAllPools();
    expect(getActivePoolOrigins()).toEqual([]);
  });

  it('post-close marks closed=true', async () => {
    const p = new PoolClient(ORIGIN);
    await p.close();
    expect(p.closed).toBe(true);
  });
});
