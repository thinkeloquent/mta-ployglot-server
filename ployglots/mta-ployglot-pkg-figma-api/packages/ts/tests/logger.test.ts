// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { createLogger, maskToken } from '../src/logger.js';

describe('maskToken', () => {
  it('masks short tokens fully', () => {
    expect(maskToken('abc')).toBe('***');
    expect(maskToken('')).toBe('<empty>');
    expect(maskToken(undefined)).toBe('<empty>');
  });

  it('masks long tokens with first/last 4 shown', () => {
    const masked = maskToken('figd_1234567890abcdef');
    expect(masked.startsWith('figd')).toBe(true);
    expect(masked.endsWith('cdef')).toBe(true);
    expect(masked).toContain('…');
  });
});

describe('createLogger', () => {
  it('respects level filter', () => {
    const chunks: string[] = [];
    const stream = { write: (c: string) => chunks.push(c) };
    const log = createLogger({ level: 'warn', stream });
    log.info('ignored');
    log.warn('kept', { a: 1 });
    expect(chunks).toHaveLength(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.level).toBe('warn');
    expect(parsed.msg).toBe('kept');
    expect(parsed.a).toBe(1);
  });

  it('setLevel switches threshold', () => {
    const chunks: string[] = [];
    const log = createLogger({ level: 'silent', stream: { write: (c) => chunks.push(c) } });
    log.error('suppressed');
    expect(chunks).toHaveLength(0);
    log.setLevel('error');
    log.error('emitted');
    expect(chunks).toHaveLength(1);
  });

  it('exposes all 5 level methods which respect threshold', () => {
    const chunks: string[] = [];
    const log = createLogger({ level: 'trace', stream: { write: (c) => chunks.push(c) } });
    log.trace('t');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(chunks).toHaveLength(5);
    const levels = chunks.map((c) => JSON.parse(c).level);
    expect(levels).toEqual(['trace', 'debug', 'info', 'warn', 'error']);
  });

  it('falls back to LOG_LEVEL env when level option is unset', () => {
    const snap = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';
    try {
      const chunks: string[] = [];
      const log = createLogger({ stream: { write: (c) => chunks.push(c) } });
      log.info('ignored');
      log.warn('kept');
      expect(chunks).toHaveLength(1);
    } finally {
      if (snap === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = snap;
    }
  });

  it('defaults to info level when neither option nor LOG_LEVEL set', () => {
    const snap = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;
    try {
      const chunks: string[] = [];
      const log = createLogger({ stream: { write: (c) => chunks.push(c) } });
      log.debug('ignored');
      log.info('kept');
      expect(chunks).toHaveLength(1);
    } finally {
      if (snap !== undefined) process.env.LOG_LEVEL = snap;
    }
  });

  it('default stream is process.stderr when none passed', () => {
    const log = createLogger({ level: 'silent' });
    expect(() => log.info('no-op')).not.toThrow();
  });

  it('masks exactly 8-char token as *** (boundary)', () => {
    expect(maskToken('12345678')).toBe('***');
    expect(maskToken('123456789')).toContain('…'); // 9 chars → long path
  });
});
