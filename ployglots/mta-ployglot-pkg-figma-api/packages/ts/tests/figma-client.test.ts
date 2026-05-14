// @ts-nocheck
import { describe, expect, it } from 'vitest';

import {
  FigmaAuthError,
  FigmaClient,
  FigmaNotFoundError,
  FigmaRateLimitError,
} from '../src/index.js';
import { createFakeFetchClient } from './_helpers.js';

describe('FigmaClient', () => {
  it('routes GET through the injected fetch client', async () => {
    const fake = createFakeFetchClient(() => ({
      status: 200,
      body: { id: 'u1', handle: 'alice', email: 'a@ex.com' },
    }));
    const client = new FigmaClient({ token: 'fake-token', fetchClient: fake });
    const me = await client.me.get();
    expect(me.handle).toBe('alice');
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].method).toBe('GET');
    expect(fake.calls[0].path).toBe('/v1/me');
  });

  it('surfaces 401 as FigmaAuthError', async () => {
    const fake = createFakeFetchClient(() => ({
      status: 401,
      body: { err: 'Invalid token' },
      text: '{"err":"Invalid token"}',
    }));
    const client = new FigmaClient({ token: 'bad', fetchClient: fake });
    await expect(client.me.get()).rejects.toBeInstanceOf(FigmaAuthError);
  });

  it('surfaces 404 as FigmaNotFoundError', async () => {
    const fake = createFakeFetchClient(() => ({ status: 404, text: 'not found' }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await expect(client.files.get('missing')).rejects.toBeInstanceOf(FigmaNotFoundError);
  });

  it('surfaces 429 as FigmaRateLimitError with retry-after', async () => {
    const fake = createFakeFetchClient(() => ({
      status: 429,
      text: 'slow down',
      headers: { 'retry-after': '7' },
    }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    try {
      await client.me.get();
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FigmaRateLimitError);
      expect((err as FigmaRateLimitError).retryAfterSeconds).toBe(7);
    }
  });

  it('passes params through to fetch client for Files.get', async () => {
    const fake = createFakeFetchClient(() => ({
      status: 200,
      body: { name: 'f', lastModified: 'x', version: '1' },
    }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.get('ABC/xyz', { ids: ['1:2', '3:4'], depth: 2 });
    expect(fake.calls[0].path).toBe('/v1/files/ABC%2Fxyz');
    expect(fake.calls[0].options.params).toEqual({ ids: '1:2,3:4', depth: 2 });
  });

  it('Comments.list unwraps the comments array', async () => {
    const fake = createFakeFetchClient(() => ({
      status: 200,
      body: { comments: [{ id: 'c1', message: 'hi' }] },
    }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    const comments = await client.comments.list('file');
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe('c1');
  });

  it('Projects.listForTeam returns the full envelope', async () => {
    const fake = createFakeFetchClient(() => ({
      status: 200,
      body: { name: 'Team A', projects: [{ id: 'p1', name: 'P1' }] },
    }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    const res = await client.projects.listForTeam('42');
    expect(res.name).toBe('Team A');
    expect(res.projects).toHaveLength(1);
  });

  it('close() delegates to the fetch client', async () => {
    const fake = createFakeFetchClient(() => ({ status: 200, body: {} }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.close();
    expect(fake.closed).toBe(true);
  });

  it('JSON decode failure on GET raises FigmaError', async () => {
    const { FigmaError } = await import('../src/index.js');
    const fake = createFakeFetchClient(() => ({ status: 200 })); // body undefined → json() throws
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await expect(client.me.get()).rejects.toBeInstanceOf(FigmaError);
  });

  it('DELETE absorbs empty body with allowEmpty', async () => {
    const fake = createFakeFetchClient(() => ({ status: 204 })); // no body → json() throws, but DELETE tolerates
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await expect(client.comments.delete('FILE', 'C1')).resolves.toBeUndefined();
  });

  it('error response with failing text() still surfaces mapped error', async () => {
    // Force the response to expose status but make text() itself throw.
    const fake = {
      calls: [] as unknown[],
      closed: false,
      async get(_path: string, _opts?: unknown) {
        return {
          status: 500,
          headers: {
            get() {
              return null;
            },
          },
          async json() {
            throw new Error('boom');
          },
          async text() {
            throw new Error('text boom');
          },
        };
      },
      async post() {
        throw new Error('not used');
      },
      async put() {
        throw new Error('not used');
      },
      async delete() {
        throw new Error('not used');
      },
      async patch() {
        throw new Error('not used');
      },
      async close() {},
    };
    const client = new FigmaClient({ token: 't', fetchClient: fake as never });
    const { FigmaServerError } = await import('../src/index.js');
    await expect(client.me.get()).rejects.toBeInstanceOf(FigmaServerError);
  });

  it('response without headers getter surfaces mapped error (null retry-after)', async () => {
    // Some transports may not expose a headers.get — FigmaClient should still map.
    const fake = {
      async get() {
        return {
          statusCode: 429,
          async json() {
            return {};
          },
          async text() {
            return 'throttled';
          },
        };
      },
      async post() {
        throw new Error('x');
      },
      async put() {
        throw new Error('x');
      },
      async delete() {
        throw new Error('x');
      },
      async patch() {
        throw new Error('x');
      },
      async close() {},
    };
    const client = new FigmaClient({ token: 't', fetchClient: fake as never });
    const { FigmaRateLimitError } = await import('../src/index.js');
    await expect(client.me.get()).rejects.toBeInstanceOf(FigmaRateLimitError);
  });

  it('statusCode getter (fetch-http-client shape) resolves status correctly', async () => {
    const fake = {
      async get() {
        return {
          statusCode: 200,
          async json() {
            return { handle: 'bob', id: 'x' };
          },
        };
      },
      async post() {
        throw new Error('x');
      },
      async put() {
        throw new Error('x');
      },
      async delete() {
        throw new Error('x');
      },
      async patch() {
        throw new Error('x');
      },
      async close() {},
    };
    const client = new FigmaClient({ token: 't', fetchClient: fake as never });
    const me = await client.me.get();
    expect(me.handle).toBe('bob');
  });

  it('default constructor uses default fetch client + default logger', () => {
    const client = new FigmaClient({ token: 't' });
    expect(typeof client.fetchClient.get).toBe('function');
    expect(typeof client.logger.info).toBe('function');
  });

  it('constructor with explicit logger uses it verbatim', async () => {
    const chunks: string[] = [];
    const customStream = { write: (c: string) => chunks.push(c) };
    const { createLogger } = await import('../src/logger.js');
    const logger = createLogger({ level: 'info', prefix: 'custom', stream: customStream });
    const client = new FigmaClient({ token: 't', logger });
    client.logger.info('hello');
    expect(chunks[0]).toContain('custom');
  });

  it('error response without text() method still maps correctly', async () => {
    const fake = {
      async get() {
        return {
          status: 404,
          headers: { get: () => null },
          async json() {
            throw new Error('no body');
          },
          // no text() method at all
        };
      },
      async post() {
        throw new Error('x');
      },
      async put() {
        throw new Error('x');
      },
      async delete() {
        throw new Error('x');
      },
      async patch() {
        throw new Error('x');
      },
      async close() {},
    };
    const client = new FigmaClient({ token: 't', fetchClient: fake as never });
    const { FigmaNotFoundError } = await import('../src/index.js');
    await expect(client.files.get('missing')).rejects.toBeInstanceOf(FigmaNotFoundError);
  });

  it('error response with status only (no statusCode) still surfaces error', async () => {
    const fake = {
      async get() {
        return {
          status: 400,
          headers: { get: () => null },
          async json() {
            throw new Error('no');
          },
          async text() {
            return 'bad request';
          },
        };
      },
      async post() {
        throw new Error('x');
      },
      async put() {
        throw new Error('x');
      },
      async delete() {
        throw new Error('x');
      },
      async patch() {
        throw new Error('x');
      },
      async close() {},
    };
    const client = new FigmaClient({ token: 't', fetchClient: fake as never });
    const { FigmaError } = await import('../src/index.js');
    await expect(client.me.get()).rejects.toBeInstanceOf(FigmaError);
  });

  it('unknown response shape (no statusCode/status) falls through to FigmaError', async () => {
    // status 0 reads back as 0 which is < 400 so we reach json(). If body can't be
    // decoded and allowEmpty=false (GET) we raise FigmaError.
    const fake = {
      async get() {
        return {
          async json() {
            throw new Error('bad json');
          },
        };
      },
      async post() {
        throw new Error('x');
      },
      async put() {
        throw new Error('x');
      },
      async delete() {
        throw new Error('x');
      },
      async patch() {
        throw new Error('x');
      },
      async close() {},
    };
    const client = new FigmaClient({ token: 't', fetchClient: fake as never });
    const { FigmaError } = await import('../src/index.js');
    await expect(client.me.get()).rejects.toBeInstanceOf(FigmaError);
  });
});
