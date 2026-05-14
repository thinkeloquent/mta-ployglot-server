// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent } from 'undici';
import { AsyncClient, Client } from './client.js';
import { CircuitOpenError } from '../retry/circuit-breaker.js';
import type { Request, Response } from '../models/index.js';

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

function setupMock(): MockAgent {
  const mock = new MockAgent();
  mock.disableNetConnect();
  return mock;
}

describe('AsyncClient (with MockAgent via mounts)', () => {
  it('Client alias === AsyncClient', () => {
    expect(Client).toBe(AsyncClient);
  });

  it('GET returns 200 + body', async () => {
    const mock = setupMock();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'hello');
    const client = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      const resp = await client.get(`${ORIGIN}/x`);
      expect(resp.statusCode).toBe(200);
      expect(await resp.text()).toBe('hello');
    } finally {
      await client.close();
    }
  });

  it('baseUrl is joined with relative paths', async () => {
    const mock = setupMock();
    mock.get(ORIGIN).intercept({ path: '/users/1', method: 'GET' }).reply(200, 'ok');
    const client = new AsyncClient({ baseUrl: `${ORIGIN}/`, mounts: { [ORIGIN]: mock } });
    try {
      const resp = await client.get('/users/1');
      expect(resp.statusCode).toBe(200);
    } finally {
      await client.close();
    }
  });

  it('POST sends JSON body via processBody', async () => {
    const mock = setupMock();
    let captured: unknown;
    mock
      .get(ORIGIN)
      .intercept({ path: '/echo', method: 'POST' })
      .reply(200, (opts) => {
        captured = opts.body;
        return 'ok';
      });
    const client = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      await client.post(`${ORIGIN}/echo`, { json: { a: 1 } });
      expect(captured).toBe('{"a":1}');
    } finally {
      await client.close();
    }
  });

  it('headers merge: ctor + per-request', async () => {
    const mock = setupMock();
    let headers: Record<string, unknown> = {};
    mock
      .get(ORIGIN)
      .intercept({ path: '/h', method: 'GET' })
      .reply(200, (opts) => {
        headers = opts.headers as Record<string, unknown>;
        return 'ok';
      });
    const client = new AsyncClient({
      headers: { 'x-base': 'b' },
      mounts: { [ORIGIN]: mock },
    });
    try {
      await client.get(`${ORIGIN}/h`, { headers: { 'x-per': 'p' } });
      expect(headers['x-base']).toBe('b');
      expect(headers['x-per']).toBe('p');
    } finally {
      await client.close();
    }
  });

  it('event hooks fire onRequest + onResponse exactly once', async () => {
    const mock = setupMock();
    mock.get(ORIGIN).intercept({ path: '/h', method: 'GET' }).reply(200, 'ok');
    const reqCalls: Request[] = [];
    const respCalls: Response[] = [];
    const client = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      eventHooks: {
        onRequest: (r: Request) => {
          reqCalls.push(r);
        },
        onResponse: (r: Response) => {
          respCalls.push(r);
        },
      },
    });
    try {
      await client.get(`${ORIGIN}/h`);
      expect(reqCalls).toHaveLength(1);
      expect(respCalls).toHaveLength(1);
    } finally {
      await client.close();
    }
  });
});

describe('AsyncClient retry', () => {
  it('retries 503 then succeeds on 200', async () => {
    const mock = setupMock();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/x', method: 'GET' }).reply(503, 'oops');
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const client = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      retry: { maxRetries: 2, retryDelay: 0, retryBackoff: 1, retryOnStatus: [503] },
    });
    try {
      const resp = await client.get(`${ORIGIN}/x`);
      expect(resp.statusCode).toBe(200);
    } finally {
      await client.close();
    }
  });

  it('exhausts retries on persistent 503', async () => {
    const mock = setupMock();
    const pool = mock.get(ORIGIN);
    for (let i = 0; i < 4; i++) {
      pool.intercept({ path: '/x', method: 'GET' }).reply(503, 'down');
    }
    const client = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      retry: { maxRetries: 3, retryDelay: 0, retryBackoff: 1, retryOnStatus: [503] },
    });
    try {
      const resp = await client.get(`${ORIGIN}/x`);
      expect(resp.statusCode).toBe(503);
    } finally {
      await client.close();
    }
  });
});

describe('AsyncClient circuit breaker', () => {
  it('opens after recorded failures and rejects subsequent requests', async () => {
    const mock = setupMock();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const client = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      circuitBreaker: { failureThreshold: 1, timeout: 60_000 },
      retry: { maxRetries: 0 },
    });
    try {
      // Manually open the breaker.
      client.circuitBreaker?.recordFailure();
      expect(client.circuitBreaker?.isOpen).toBe(true);
      await expect(client.get(`${ORIGIN}/x`)).rejects.toBeInstanceOf(CircuitOpenError);
    } finally {
      await client.close();
    }
  });
});

describe('AsyncClient lifecycle', () => {
  it('closed flag flips after close()', async () => {
    const client = new AsyncClient({});
    expect(client.closed).toBe(false);
    await client.close();
    expect(client.closed).toBe(true);
  });

  it('close() is idempotent', async () => {
    const client = new AsyncClient({});
    await client.close();
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('request after close throws "Client has been closed"', async () => {
    const client = new AsyncClient({});
    await client.close();
    await expect(client.get('http://example.com/x')).rejects.toThrow(/Client has been closed/);
  });

  it('Symbol.asyncDispose closes the client', async () => {
    const client = new AsyncClient({});
    await client[Symbol.asyncDispose]();
    expect(client.closed).toBe(true);
  });
});
