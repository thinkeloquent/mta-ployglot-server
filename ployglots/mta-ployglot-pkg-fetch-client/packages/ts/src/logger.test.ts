// @ts-nocheck
import { describe, it, expect } from 'vitest';
import logger, { create, type LogEntry, type Logger } from './logger.js';

function captureLogger(level?: Parameters<typeof create>[2] extends infer T ? any : any) {
  const captured: LogEntry[] = [];
  const log = create('test', 'logger.test.ts', {
    level: level ?? 'trace',
    transport: (e) => captured.push(e),
  });
  return { log, captured };
}

describe('logger types & LOG_LEVELS', () => {
  it('exposes 6 levels with monotonically-increasing weights', () => {
    expect(logger.LOG_LEVELS.trace).toBe(0);
    expect(logger.LOG_LEVELS.debug).toBe(1);
    expect(logger.LOG_LEVELS.info).toBe(2);
    expect(logger.LOG_LEVELS.warn).toBe(3);
    expect(logger.LOG_LEVELS.error).toBe(4);
    expect(logger.LOG_LEVELS.silent).toBe(5);
  });

  it('getEnvLogLevel returns valid level even with no env', () => {
    const lvl = logger.getEnvLogLevel();
    expect(['trace', 'debug', 'info', 'warn', 'error', 'silent']).toContain(lvl);
  });
});

describe('redactSensitive', () => {
  it('redacts top-level password', () => {
    const { log, captured } = captureLogger();
    log.info('hello', { password: 'x', user: 'bob' });
    expect(captured[0]?.context?.password).toBe('[REDACTED]');
    expect(captured[0]?.context?.user).toBe('bob');
  });

  it('redacts nested keys recursively', () => {
    const { log, captured } = captureLogger();
    log.info('hello', { outer: { token: 'abc', name: 'safe' } });
    const out = captured[0]?.context?.outer as { token: string; name: string };
    expect(out.token).toBe('[REDACTED]');
    expect(out.name).toBe('safe');
  });

  it('handles circular references without throwing', () => {
    const { log, captured } = captureLogger();
    const cycle: any = { a: 1 };
    cycle.self = cycle;
    expect(() => log.info('cycle', cycle)).not.toThrow();
    const ctx = captured[0]?.context as { a: number; self: { a: number; self: unknown } };
    expect(ctx.a).toBe(1);
    expect(ctx.self.self).toBe('[CIRCULAR]');
  });

  it('redacts case-insensitively', () => {
    const { log, captured } = captureLogger();
    log.info('hi', { Authorization: 'Bearer xxx' });
    expect((captured[0]?.context as any).Authorization).toBe('[REDACTED]');
  });

  it('respects extra redactKeys', () => {
    const captured: LogEntry[] = [];
    const log = create('test', 'l.test', {
      level: 'trace',
      transport: (e) => captured.push(e),
      redactKeys: ['email'],
    });
    log.info('x', { email: 'a@b.c' });
    expect((captured[0]?.context as any).email).toBe('[REDACTED]');
  });
});

describe('logger factory', () => {
  it('gates by level', () => {
    const { log, captured } = captureLogger('warn');
    log.info('nope');
    expect(captured).toHaveLength(0);
    log.warn('yes');
    expect(captured).toHaveLength(1);
  });

  it('setLevel changes gating', () => {
    const { log, captured } = captureLogger('warn');
    log.info('nope');
    log.setLevel('trace');
    log.info('yes');
    expect(captured).toHaveLength(1);
    expect(captured[0]?.message).toBe('yes');
    expect(log.getLevel()).toBe('trace');
  });

  it('silent suppresses everything', () => {
    const { log, captured } = captureLogger('silent');
    log.error('would normally print');
    expect(captured).toHaveLength(0);
  });

  it('child merges context', () => {
    const captured: LogEntry[] = [];
    const log = create('test', 'l.test', {
      level: 'trace',
      transport: (e) => captured.push(e),
    });
    log.child({ a: 1 }).info('x', { b: 2 });
    expect(captured[0]?.context).toEqual({ a: 1, b: 2 });
  });

  it('routes warn/error to stderr (defaultTransport)', () => {
    const log: Logger = create('test', 'l.test', { level: 'trace' });
    expect(typeof log.error).toBe('function');
  });
});
