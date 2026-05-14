// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { PoolClient, getPool, closeAllPools } from './pool.js';

let server: Server;
let origin: string;
let handler: (req: IncomingMessage, res: ServerResponse) => void = (_req, res) => {
  res.statusCode = 200;
  res.end('null');
};

beforeAll(async () => {
  server = createServer((req, res) => handler(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('server address unavailable');
  origin = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await closeAllPools();
});

afterEach(async () => {
  await closeAllPools();
});

describe('PoolClient verbs', () => {
  it('GET parses JSON response', async () => {
    handler = (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: 1 }));
    };
    const p = new PoolClient(origin);
    try {
      const data = await p.get<{ id: number }>('/u');
      expect(data).toEqual({ id: 1 });
    } finally {
      await p.close();
    }
  });

  it('POST serialises JSON body + sets content-type', async () => {
    let captured = '';
    let capturedCt = '';
    handler = (req, res) => {
      capturedCt = req.headers['content-type'] ?? '';
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        captured = Buffer.concat(chunks).toString();
        res.setHeader('content-type', 'application/json');
        res.end('{"ok":true}');
      });
    };
    const p = new PoolClient(origin);
    try {
      await p.post('/u', { a: 1 });
      expect(captured).toBe('{"a":1}');
      expect(capturedCt).toBe('application/json');
    } finally {
      await p.close();
    }
  });

  it('PUT / PATCH / DELETE / generic request', async () => {
    handler = (req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ m: req.method }));
    };
    const p = new PoolClient(origin);
    try {
      expect(await p.put<{ m: string }>('/v', { x: 1 })).toEqual({ m: 'PUT' });
      expect(await p.patch<{ m: string }>('/v', { x: 1 })).toEqual({ m: 'PATCH' });
      expect(await p.delete<{ m: string }>('/v')).toEqual({ m: 'DELETE' });
      expect(await p.request<{ m: string }>('OPTIONS', '/v')).toEqual({ m: 'OPTIONS' });
    } finally {
      await p.close();
    }
  });

  it('4xx throws plain Error with HTTP-prefixed message', async () => {
    handler = (_req, res) => {
      res.statusCode = 404;
      res.end('not found here');
    };
    const p = new PoolClient(origin);
    try {
      await expect(p.get('/missing')).rejects.toThrow(/HTTP 404: not found here/);
    } finally {
      await p.close();
    }
  });

  it('5xx throws plain Error with HTTP-prefixed message', async () => {
    handler = (_req, res) => {
      res.statusCode = 503;
      res.end('overloaded');
    };
    const p = new PoolClient(origin);
    try {
      await expect(p.get('/down')).rejects.toThrow(/HTTP 503: overloaded/);
    } finally {
      await p.close();
    }
  });

  it('respects custom timeoutMs override per request', async () => {
    handler = (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end('null');
    };
    const p = new PoolClient(origin, { timeoutMs: 1000 });
    try {
      await p.get('/u', { timeoutMs: 2000 });
    } finally {
      await p.close();
    }
  });

  it('default headers + per-request headers merge', async () => {
    let captured: Record<string, string | string[] | undefined> = {};
    handler = (req, res) => {
      captured = req.headers;
      res.setHeader('content-type', 'application/json');
      res.end('null');
    };
    const p = new PoolClient(origin, { headers: { 'x-default': 'd' } });
    try {
      await p.get('/u', { headers: { 'x-call': 'c' } });
      expect(captured['x-default']).toBe('d');
      expect(captured['x-call']).toBe('c');
    } finally {
      await p.close();
    }
  });

  it('originHost getter exposes the host', async () => {
    const p = new PoolClient(origin);
    expect(p.originHost).toBe(origin);
    await p.close();
  });

  it('Symbol.asyncDispose closes', async () => {
    const p = new PoolClient(origin);
    await p[Symbol.asyncDispose]();
    expect(p.closed).toBe(true);
  });

  it('close is idempotent', async () => {
    const p = new PoolClient(origin);
    await p.close();
    await expect(p.close()).resolves.toBeUndefined();
  });

  it('getPool rebuilds a fresh pool when previous was directly closed', async () => {
    const a = getPool(origin);
    await a.close();
    const b = getPool(origin);
    expect(b).not.toBe(a);
    await b.close();
  });

  it('GET preserves caller-supplied content-type header', async () => {
    let ct = '';
    handler = (req, res) => {
      ct = (req.headers['content-type'] as string) ?? '';
      res.setHeader('content-type', 'application/json');
      res.end('null');
    };
    const p = new PoolClient(origin);
    try {
      await p.post('/u', { a: 1 }, { headers: { 'content-type': 'application/vnd.api+json' } });
      expect(ct).toBe('application/vnd.api+json');
    } finally {
      await p.close();
    }
  });
});
