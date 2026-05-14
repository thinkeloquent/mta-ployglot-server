// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import * as verbs from './convenience.js';

let server: Server;
let origin: string;
let lastMethod = '';

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    lastMethod = req.method ?? '';
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  origin = `http://127.0.0.1:${addr.port}`;
});

beforeEach(() => {
  lastMethod = '';
});

afterEach(async () => {
  await verbs.closeDefaultClient();
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe('module-level exports', () => {
  it('exports verb functions + delete alias', () => {
    expect(typeof verbs.get).toBe('function');
    expect(typeof verbs.post).toBe('function');
    expect(typeof verbs.put).toBe('function');
    expect(typeof verbs.patch).toBe('function');
    expect(typeof verbs.delete).toBe('function');
    expect(typeof verbs.del).toBe('function');
    expect(typeof verbs.head).toBe('function');
    expect(typeof verbs.options).toBe('function');
    expect(typeof verbs.request).toBe('function');
    expect(typeof verbs.closeDefaultClient).toBe('function');
  });

  it('delete is the same function as del', () => {
    expect(verbs.delete).toBe(verbs.del);
  });
});

describe('default-client lifecycle', () => {
  it('GET against local server', async () => {
    const r = await verbs.get(`${origin}/x`);
    expect(r.statusCode).toBe(200);
    expect(lastMethod).toBe('GET');
  });

  it('POST against local server', async () => {
    const r = await verbs.post(`${origin}/x`);
    expect(r.statusCode).toBe(200);
    expect(lastMethod).toBe('POST');
  });

  it('PUT', async () => {
    await verbs.put(`${origin}/x`);
    expect(lastMethod).toBe('PUT');
  });

  it('PATCH', async () => {
    await verbs.patch(`${origin}/x`);
    expect(lastMethod).toBe('PATCH');
  });

  it('DELETE (via del)', async () => {
    await verbs.del(`${origin}/x`);
    expect(lastMethod).toBe('DELETE');
  });

  it('HEAD', async () => {
    await verbs.head(`${origin}/x`);
    expect(lastMethod).toBe('HEAD');
  });

  it('OPTIONS', async () => {
    await verbs.options(`${origin}/x`);
    expect(lastMethod).toBe('OPTIONS');
  });

  it('generic request()', async () => {
    await verbs.request('GET', `${origin}/x`);
    expect(lastMethod).toBe('GET');
  });

  it('default client is reused across calls', async () => {
    const a = await verbs.get(`${origin}/x`);
    const b = await verbs.get(`${origin}/x`);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
  });

  it('closeDefaultClient is idempotent', async () => {
    await verbs.get(`${origin}/x`);
    await verbs.closeDefaultClient();
    await expect(verbs.closeDefaultClient()).resolves.toBeUndefined();
  });

  it('after close, next call rebuilds the default client', async () => {
    await verbs.get(`${origin}/x`);
    await verbs.closeDefaultClient();
    const r = await verbs.get(`${origin}/x`);
    expect(r.statusCode).toBe(200);
  });
});
