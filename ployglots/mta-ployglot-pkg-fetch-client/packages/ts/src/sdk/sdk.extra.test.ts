// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MockAgent } from 'undici';
import { SDK, createSDK } from './core.js';
import { BasicAuth } from '../auth/basic.js';
import { BearerAuth, APIKeyAuth } from '../auth/bearer.js';
import { JitterStrategy } from '../retry/jitter.js';

const ORIGIN = 'http://sdk.test';

function mountMock(sdk: SDK, mock: MockAgent): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sdk as any)._client._mountRouter.mount(ORIGIN, mock);
}

describe('SDK._buildAuth', () => {
  it('basic config wires BasicAuth on the inner client', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN, auth: { type: 'basic', username: 'u', password: 'p' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdk as any)._client._auth).toBeInstanceOf(BasicAuth);
    await sdk.close();
  });

  it('bearer config wires BearerAuth', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN, auth: { type: 'bearer', token: 'abc' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdk as any)._client._auth).toBeInstanceOf(BearerAuth);
    await sdk.close();
  });

  it('api-key config wires APIKeyAuth (default header)', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN, auth: { type: 'api-key', apiKey: 'k' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdk as any)._client._auth).toBeInstanceOf(APIKeyAuth);
    await sdk.close();
  });

  it('api-key config with custom header', async () => {
    const sdk = new SDK({
      baseUrl: ORIGIN,
      auth: { type: 'api-key', apiKey: 'k', headerName: 'X-Custom' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdk as any)._client._auth).toBeInstanceOf(APIKeyAuth);
    await sdk.close();
  });

  it('custom auth passes through the user instance', async () => {
    const customAuth = new BearerAuth('custom');
    const sdk = new SDK({ baseUrl: ORIGIN, auth: { type: 'custom', auth: customAuth } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdk as any)._client._auth).toBe(customAuth);
    await sdk.close();
  });

  it('custom type with no auth instance falls back to NoAuth', async () => {
    const sdk = new SDK({ baseUrl: ORIGIN, auth: { type: 'custom' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdk as any)._client._auth.constructor.name).toBe('NoAuth');
    await sdk.close();
  });
});

describe('SDK._request retry behaviour', () => {
  it('retries 503 on retryOnStatus then succeeds', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/x', method: 'GET' }).reply(503, '');
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, '{"id":1}', {
      headers: { 'content-type': 'application/json' },
    });
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 2,
      retryDelay: 0,
      retryBackoff: 1,
      jitter: JitterStrategy.NONE,
    });
    mountMock(sdk, mock);
    try {
      const r = await sdk.get<{ id: number }>('/x');
      expect(r.success).toBe(true);
      expect(r.data).toEqual({ id: 1 });
    } finally {
      await sdk.close();
    }
  });

  it('exhausts retries on persistent 503 → returns 503 with HTTP error', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    for (let i = 0; i < 3; i++) {
      pool.intercept({ path: '/x', method: 'GET' }).reply(503, '');
    }
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 2,
      retryDelay: 0,
      retryBackoff: 1,
      jitter: JitterStrategy.NONE,
    });
    mountMock(sdk, mock);
    try {
      const r = await sdk.get('/x');
      expect(r.success).toBe(false);
      expect(r.statusCode).toBe(503);
    } finally {
      await sdk.close();
    }
  });

  it('respects Retry-After header in retry delay', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    pool
      .intercept({ path: '/x', method: 'GET' })
      .reply(429, '', { headers: { 'retry-after': '0' } });
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'null', {
      headers: { 'content-type': 'application/json' },
    });
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 1,
      retryDelay: 0,
      retryBackoff: 1,
      jitter: JitterStrategy.NONE,
      respectRetryAfter: true,
    });
    mountMock(sdk, mock);
    try {
      const r = await sdk.get('/x');
      expect(r.success).toBe(true);
    } finally {
      await sdk.close();
    }
  });

  it('non-retryable error returns synthetic error response (statusCode 0)', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).replyWithError(new Error('mystery'));
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 0,
      retryOnException: false,
    });
    mountMock(sdk, mock);
    try {
      const r = await sdk.get('/x');
      expect(r.success).toBe(false);
      expect(r.statusCode).toBe(0);
      expect(r.error).toBeTruthy();
    } finally {
      await sdk.close();
    }
  });

  it('records circuit-breaker failure on retryable status (observed via persistent failure)', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    for (let i = 0; i < 3; i++) {
      pool.intercept({ path: '/x', method: 'GET' }).reply(503, '');
    }
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 2,
      retryDelay: 0,
      retryBackoff: 1,
      jitter: JitterStrategy.NONE,
      circuitBreaker: { failureThreshold: 100 },
    });
    mountMock(sdk, mock);
    try {
      const r = await sdk.get('/x');
      // All attempts failed → no recordSuccess → failures stay logged.
      expect(r.success).toBe(false);
      expect(sdk.circuitBreaker?.failureCount).toBeGreaterThanOrEqual(1);
    } finally {
      await sdk.close();
    }
  });
});

describe('SDK verb coverage', () => {
  it('post / put / patch / delete delegate via _request', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      pool.intercept({ path: '/v', method: m }).reply(200, 'null', {
        headers: { 'content-type': 'application/json' },
      });
    }
    const sdk = createSDK({ baseUrl: ORIGIN, maxRetries: 0 });
    mountMock(sdk, mock);
    try {
      expect((await sdk.post('/v')).success).toBe(true);
      expect((await sdk.put('/v')).success).toBe(true);
      expect((await sdk.patch('/v')).success).toBe(true);
      expect((await sdk.delete('/v')).success).toBe(true);
    } finally {
      await sdk.close();
    }
  });
});
