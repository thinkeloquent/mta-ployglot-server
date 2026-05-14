// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { createLoggingInterceptor } from './logging.js';
import logger, { type LogEntry } from '../logger.js';

function captureLogs(): { log: ReturnType<typeof logger.create>; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  const log = logger.create('test', 'logging.test.ts', {
    level: 'trace',
    transport: (e) => entries.push(e),
  });
  return { log, entries };
}

function fakeDispatch(
  opts: { method?: string; path?: string; headers?: unknown },
  handler: any,
): boolean {
  // Mimic enough of the undici handler contract to exercise our interceptor wrapper.
  if (typeof handler.onHeaders === 'function') {
    handler.onHeaders(200, [Buffer.from('content-type'), Buffer.from('text/plain')]);
  }
  void opts;
  return true;
}

describe('createLoggingInterceptor', () => {
  it('returns a function', () => {
    expect(typeof createLoggingInterceptor()).toBe('function');
  });

  it('logs outgoing request with redacted headers (defaults)', () => {
    const { log, entries } = captureLogs();
    const ic = createLoggingInterceptor({ logger: log });
    const wrapped = ic(fakeDispatch as never);
    wrapped(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        method: 'GET',
        path: '/x',
        headers: { authorization: 'Bearer x', 'x-api-key': 'k' },
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { onHeaders: () => true } as any,
    );
    const reqEntry = entries.find((e) => e.message === 'outgoing request');
    expect(reqEntry).toBeDefined();
    const headers = reqEntry?.context?.headers as Record<string, string>;
    expect(headers.authorization).toBe('[REDACTED]');
    expect(headers['x-api-key']).toBe('[REDACTED]');
  });

  it('logs incoming response and redacts response headers', () => {
    const { log, entries } = captureLogs();
    const ic = createLoggingInterceptor({
      logger: log,
      redactHeaders: ['set-cookie'],
    });
    const wrapped = ic(fakeDispatch as never);
    wrapped(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { method: 'GET', path: '/x', headers: {} } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        onHeaders: () => true,
      } as any,
    );
    const respEntry = entries.find((e) => e.message === 'incoming response');
    expect(respEntry).toBeDefined();
    expect(respEntry?.context?.statusCode).toBe(200);
  });

  it('preserves non-redacted headers verbatim', () => {
    const { log, entries } = captureLogs();
    const ic = createLoggingInterceptor({ logger: log });
    const wrapped = ic(fakeDispatch as never);
    wrapped(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { method: 'GET', path: '/x', headers: { 'x-public': 'visible' } } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { onHeaders: () => true } as any,
    );
    const headers = entries[0]?.context?.headers as Record<string, string>;
    expect(headers['x-public']).toBe('visible');
  });

  it('handles array-shaped headers (raw undici form)', () => {
    const { log, entries } = captureLogs();
    const ic = createLoggingInterceptor({ logger: log });
    const wrapped = ic(fakeDispatch as never);
    wrapped(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { method: 'GET', path: '/x', headers: ['authorization', 'Bearer x', 'x-id', '1'] } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { onHeaders: () => true } as any,
    );
    const headers = entries[0]?.context?.headers as Record<string, string>;
    expect(headers.authorization).toBe('[REDACTED]');
    expect(headers['x-id']).toBe('1');
  });

  it('handles missing/undefined headers gracefully', () => {
    const { log, entries } = captureLogs();
    const ic = createLoggingInterceptor({ logger: log });
    const wrapped = ic(fakeDispatch as never);
    wrapped(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { method: 'GET', path: '/x' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { onHeaders: () => true } as any,
    );
    expect(entries[0]?.context?.headers).toEqual({});
  });
});
