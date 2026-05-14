// @ts-nocheck
import { describe, expect, it } from 'vitest';

import {
  FigmaAuthError,
  FigmaError,
  FigmaNotFoundError,
  FigmaRateLimitError,
  FigmaServerError,
  mapHttpError,
} from '../src/errors.js';

describe('mapHttpError', () => {
  const ctx = (status: number, extra: { retryAfter?: string | null; body?: string } = {}) => ({
    method: 'GET',
    url: '/v1/me',
    status,
    body: extra.body ?? '',
    retryAfter: extra.retryAfter ?? null,
  });

  it('401 → FigmaAuthError', () => {
    const err = mapHttpError(ctx(401));
    expect(err).toBeInstanceOf(FigmaAuthError);
    expect(err.message).toContain('GET /v1/me → 401');
  });

  it('403 → FigmaAuthError with status=403', () => {
    const err = mapHttpError(ctx(403)) as FigmaAuthError;
    expect(err).toBeInstanceOf(FigmaAuthError);
    expect(err.status).toBe(403);
  });

  it('404 → FigmaNotFoundError', () => {
    const err = mapHttpError(ctx(404));
    expect(err).toBeInstanceOf(FigmaNotFoundError);
  });

  it('429 → FigmaRateLimitError with retry-after', () => {
    const err = mapHttpError(ctx(429, { retryAfter: '42' })) as FigmaRateLimitError;
    expect(err).toBeInstanceOf(FigmaRateLimitError);
    expect(err.retryAfterSeconds).toBe(42);
  });

  it('500 → FigmaServerError', () => {
    const err = mapHttpError(ctx(503)) as FigmaServerError;
    expect(err).toBeInstanceOf(FigmaServerError);
    expect(err.status).toBe(503);
  });

  it('other 4xx → base FigmaError', () => {
    const err = mapHttpError(ctx(418));
    expect(err).toBeInstanceOf(FigmaError);
    expect(err).not.toBeInstanceOf(FigmaAuthError);
  });

  it('truncates body snippet to 200 chars', () => {
    const err = mapHttpError(ctx(400, { body: 'x'.repeat(500) }));
    expect(err.message.length).toBeLessThan(400);
  });

  it('429 with non-numeric retry-after → retryAfterSeconds undefined', () => {
    const err = mapHttpError(ctx(429, { retryAfter: 'not-a-number' })) as FigmaRateLimitError;
    expect(err).toBeInstanceOf(FigmaRateLimitError);
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('429 without retry-after → retryAfterSeconds undefined', () => {
    const err = mapHttpError(ctx(429)) as FigmaRateLimitError;
    expect(err.retryAfterSeconds).toBeUndefined();
  });
});

describe('FigmaError hierarchy constructors', () => {
  it('FigmaError carries cause', async () => {
    const { FigmaError } = await import('../src/errors.js');
    const inner = new Error('inner');
    const err = new FigmaError('outer', { cause: inner });
    expect(err.message).toBe('outer');
    expect(err.cause).toBe(inner);
    expect(err.name).toBe('FigmaError');
  });

  it('FigmaConfigError is an Error subclass with cause', async () => {
    const { FigmaConfigError } = await import('../src/errors.js');
    const err = new FigmaConfigError('bad', { cause: 'detail' });
    expect(err.name).toBe('FigmaConfigError');
    expect(err.cause).toBe('detail');
  });

  it('FigmaTransportError is constructible with cause', async () => {
    const { FigmaTransportError } = await import('../src/errors.js');
    const inner = new Error('ECONNRESET');
    const err = new FigmaTransportError('network blew up', { cause: inner });
    expect(err.name).toBe('FigmaTransportError');
    expect(err.cause).toBe(inner);
    expect(err.message).toBe('network blew up');
  });

  it('FigmaTransportError works without options', async () => {
    const { FigmaTransportError } = await import('../src/errors.js');
    const err = new FigmaTransportError('no cause');
    expect(err.cause).toBeUndefined();
  });
});
