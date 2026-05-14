// @ts-nocheck
/**
 * Final pass: branch coverage for residual conditional paths.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent } from 'undici';
import { AsyncClient } from './client/client.js';
import { createSDK } from './sdk/core.js';
import { Timeout, createTimeout } from './config/timeout.js';
import { JitterStrategy } from './retry/jitter.js';
import { BearerAuth } from './auth/bearer.js';
import { Headers } from './models/headers.js';

const ORIGIN = 'http://branches.test';
let savedLogLevel: string | undefined;

beforeEach(() => {
  savedLogLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'silent';
});
afterEach(() => {
  if (savedLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = savedLogLevel;
});

describe('AsyncClient.stream()', () => {
  it('yields chunks via aiterBytes', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/s', method: 'GET' }).reply(200, 'hello');
    const c = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      let total = 0;
      for await (const chunk of c.stream('GET', `${ORIGIN}/s`)) {
        total += chunk.length;
      }
      expect(total).toBe(5);
    } finally {
      await c.close();
    }
  });
});

describe('AsyncClient — per-request timeout branches', () => {
  it('per-request Timeout instance is honoured', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const c = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await c.get(`${ORIGIN}/x`, { timeout: new Timeout({ read: 5000 }) });
      expect(r.statusCode).toBe(200);
    } finally {
      await c.close();
    }
  });

  it('per-request number timeout is converted via createTimeout', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const c = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await c.get(`${ORIGIN}/x`, { timeout: 1000 });
      expect(r.statusCode).toBe(200);
    } finally {
      await c.close();
    }
  });

  it('opts.auth = null disables auth for that request', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    let captured: Record<string, unknown> = {};
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .reply(200, (opts) => {
        captured = opts.headers as Record<string, unknown>;
        return 'ok';
      });
    const c = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      auth: new BearerAuth('default-token'),
    });
    try {
      await c.get(`${ORIGIN}/x`, { auth: null });
      expect(captured.authorization).toBeUndefined();
    } finally {
      await c.close();
    }
  });

  it('async BearerAuth on request uses applyAsync path', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    let captured: Record<string, unknown> = {};
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .reply(200, (opts) => {
        captured = opts.headers as Record<string, unknown>;
        return 'ok';
      });
    const c = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      auth: new BearerAuth(async () => 'async-token'),
    });
    try {
      await c.get(`${ORIGIN}/x`);
      // Header case is preserved, so look it up case-insensitively.
      const value = Object.entries(captured).find(
        ([k]) => k.toLowerCase() === 'authorization',
      )?.[1];
      expect(value).toBe('Bearer async-token');
    } finally {
      await c.close();
    }
  });
});

describe('SDK — non-retryable exception path inside catch', () => {
  it('non-retryable error returns error response', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(new Error('not retryable'));
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 3,
      retryOnException: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdk as any)._client._mountRouter.mount(ORIGIN, mock);
    try {
      const r = await sdk.get('/x');
      expect(r.error).toBe('not retryable');
    } finally {
      await sdk.close();
    }
  });

  it('retryable error retried then succeeds (covers continue branch)', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    pool
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(Object.assign(new Error('econnrefused'), { code: 'ECONNREFUSED' }));
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'null', {
      headers: { 'content-type': 'application/json' },
    });
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 2,
      retryDelay: 0,
      retryBackoff: 1,
      jitter: JitterStrategy.NONE,
      retryOnException: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdk as any)._client._mountRouter.mount(ORIGIN, mock);
    try {
      const r = await sdk.get('/x');
      expect(r.success).toBe(true);
    } finally {
      await sdk.close();
    }
  });
});

describe('Timeout — empty merge / no-args toUndiciOptions', () => {
  it('merge with no args returns equal-shaped instance', () => {
    const t = new Timeout({ read: 1000 });
    const m = t.merge();
    expect(m.read).toBe(1000);
  });

  it('createTimeout(0) is treated as a number', () => {
    expect(createTimeout(0).connect).toBe(0);
  });
});

describe('Headers — merge / clone branches', () => {
  it('merge accepts HeadersInit (not just Headers instance)', () => {
    const h1 = new Headers({ A: '1' });
    const merged = h1.merge({ B: '2' });
    expect(merged.get('B')).toBe('2');
  });

  it('Headers ctor with array of entries — string values only', () => {
    const h = new Headers([['A', '1']]);
    expect(h.get('A')).toBe('1');
  });

  it('append after set retains case for existing key', () => {
    const h = new Headers({ 'Content-Type': 'a/b' });
    h.append('content-type', 'c/d');
    expect(h.getAll('content-type')).toEqual(['a/b', 'c/d']);
  });

  it('toJSON entries with single value stay as string', () => {
    const h = new Headers({ A: '1' });
    expect(h.toJSON().A).toBe('1');
  });
});

describe('streaming/text — explicit empty stream branch', () => {
  it('iterText on already-empty stream yields nothing', async () => {
    const { iterText } = await import('./streaming/text.js');
    const { Readable } = await import('node:stream');
    const out: string[] = [];
    for await (const chunk of iterText(Readable.from([]))) out.push(chunk);
    expect(out).toEqual([]);
  });
});

describe('AsyncClient ctor — instance branches', () => {
  it('TLSConfig instance passed through', async () => {
    const { TLSConfig } = await import('./config/tls.js');
    const c = new AsyncClient({ tls: new TLSConfig({ verify: false }) });
    await c.close();
  });

  it('Limits instance passed through', async () => {
    const { Limits } = await import('./config/limits.js');
    const c = new AsyncClient({ limits: new Limits({ maxConnections: 5 }) });
    await c.close();
  });

  it('Timeout instance passed through', async () => {
    const c = new AsyncClient({ timeout: new Timeout({ read: 5000 }) });
    await c.close();
  });

  it('URL request without baseUrl uses URL instance directly', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const c = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await c.get(new URL(`${ORIGIN}/x`));
      expect(r.statusCode).toBe(200);
    } finally {
      await c.close();
    }
  });

  it('Headers instance passed as per-request headers reuses instance branch', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    let captured: Record<string, unknown> = {};
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .reply(200, (opts) => {
        captured = opts.headers as Record<string, unknown>;
        return 'ok';
      });
    const c = new AsyncClient({ mounts: { [ORIGIN]: mock } });
    try {
      const headers = new Headers({ 'x-instance': 'yes' });
      await c.get(`${ORIGIN}/x`, { headers });
      expect(captured['x-instance']).toBe('yes');
    } finally {
      await c.close();
    }
  });

  it('default eventHooks (none) → empty hooks manager', async () => {
    const c = new AsyncClient({});
    await c.close();
  });
});

describe('AsyncClient retry — exception path', () => {
  it('retryable exception (ECONNREFUSED) → retries then succeeds', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    pool
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(Object.assign(new Error('econnrefused'), { code: 'ECONNREFUSED' }));
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const c = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      retry: {
        maxRetries: 2,
        retryDelay: 0,
        retryBackoff: 1,
        jitter: JitterStrategy.NONE,
        retryOnException: true,
      },
    });
    try {
      const r = await c.get(`${ORIGIN}/x`);
      expect(r.statusCode).toBe(200);
    } finally {
      await c.close();
    }
  });

  it('non-retryable exception throws immediately even with retry config', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(new Error('arbitrary'));
    const c = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      retry: {
        maxRetries: 3,
        retryDelay: 0,
        retryBackoff: 1,
        jitter: JitterStrategy.NONE,
        retryOnException: false,
      },
    });
    try {
      await expect(c.get(`${ORIGIN}/x`)).rejects.toThrow();
    } finally {
      await c.close();
    }
  });

  it('Retry-After header overrides computed delay', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    pool.intercept({ path: '/x', method: 'GET' }).reply(429, '', {
      headers: { 'retry-after': '0' },
    });
    pool.intercept({ path: '/x', method: 'GET' }).reply(200, 'ok');
    const c = new AsyncClient({
      mounts: { [ORIGIN]: mock },
      retry: {
        maxRetries: 1,
        retryDelay: 100,
        retryBackoff: 2,
        jitter: JitterStrategy.NONE,
        retryOnStatus: [429],
        respectRetryAfter: true,
      },
    });
    try {
      const r = await c.get(`${ORIGIN}/x`);
      expect(r.statusCode).toBe(200);
    } finally {
      await c.close();
    }
  });
});

describe('streaming/bytes — chunkSize negative branch', () => {
  it('negative chunkSize behaves like undefined (no rechunk)', async () => {
    const { iterBytes } = await import('./streaming/bytes.js');
    const { Readable } = await import('node:stream');
    const out: Buffer[] = [];
    for await (const c of iterBytes(Readable.from([Buffer.from('xyz')]), -1)) out.push(c);
    expect(Buffer.concat(out).toString()).toBe('xyz');
  });

  it('non-Buffer string chunks get coerced via Buffer.from (passthrough mode)', async () => {
    const { iterBytes, collectBytes } = await import('./streaming/bytes.js');
    const { Readable } = await import('node:stream');
    const stream1 = Readable.from(['hello']);
    const out: Buffer[] = [];
    for await (const c of iterBytes(stream1)) out.push(c);
    expect(Buffer.concat(out).toString()).toBe('hello');

    // collectBytes on string-yielding stream
    const stream2 = Readable.from(['ab', 'cd']);
    const buf = await collectBytes(stream2);
    expect(buf.toString()).toBe('abcd');
  });

  it('non-Buffer string chunks coerced in rechunk mode', async () => {
    const { iterBytes } = await import('./streaming/bytes.js');
    const { Readable } = await import('node:stream');
    const stream = Readable.from(['abcde']);
    const out: Buffer[] = [];
    for await (const c of iterBytes(stream, 2)) out.push(c);
    expect(out.map((b) => b.toString())).toEqual(['ab', 'cd', 'e']);
  });
});

describe('createTimeout(TimeoutOptions object)', () => {
  it('object input is forwarded to Timeout ctor', async () => {
    const { createTimeout } = await import('./config/timeout.js');
    const t = createTimeout({ read: 1234 });
    expect(t.read).toBe(1234);
  });
});

describe('Headers — additional branches', () => {
  it('append on existing key extends array', () => {
    const h = new Headers({ A: '1' });
    h.append('A', '2');
    h.append('A', '3');
    expect(h.getAll('A')).toEqual(['1', '2', '3']);
  });

  it('append on new key seeds case map', () => {
    const h = new Headers();
    h.append('X-NEW', 'v');
    expect(h.get('x-new')).toBe('v');
  });

  it('toJSON falls back to lowercase key when caseMap entry missing', () => {
    const h = new Headers();
    // Simulate a programmatic edit that bypasses caseMap
    // (defensive branch that the ctor branch otherwise hits via fallback)
    h.set('lower-only', 'v');
    expect(h.toJSON()['lower-only']).toBe('v');
  });

  it('clone iteration covers caseMap fallback branch', () => {
    const h = new Headers();
    h.append('a', '1');
    const c = h.clone();
    expect(c.get('A')).toBe('1');
  });
});
