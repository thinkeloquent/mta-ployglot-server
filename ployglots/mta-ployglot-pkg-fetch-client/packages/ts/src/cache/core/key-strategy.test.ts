// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  defaultKeyStrategy,
  createDotNotationKeyStrategy,
  createHashedKeyStrategy,
  combineKeyStrategies,
} from './key-strategy.js';

describe('defaultKeyStrategy', () => {
  it('uppercases method, joins with URL string', () => {
    expect(defaultKeyStrategy('get', 'https://x.test/a')).toBe('GET:https://x.test/a');
  });

  it('accepts URL object', () => {
    const u = new URL('https://x.test/a?b=1');
    expect(defaultKeyStrategy('POST', u)).toBe(`POST:${u.toString()}`);
  });
});

describe('createDotNotationKeyStrategy', () => {
  it('extracts top-level header value', () => {
    const s = createDotNotationKeyStrategy(['headers.x-user-id']);
    const key = s('GET', '/x', { 'x-user-id': '42' });
    expect(key).toContain('42');
  });

  it('handles missing path → null in output', () => {
    const s = createDotNotationKeyStrategy(['headers.missing']);
    expect(s('GET', '/x', {})).toContain('null');
  });

  it('walks nested objects', () => {
    const s = createDotNotationKeyStrategy(['body.user.id']);
    expect(s('GET', '/x', undefined, { user: { id: 7 } })).toContain('7');
  });

  it('multiple paths are joined with |', () => {
    const s = createDotNotationKeyStrategy(['headers.a', 'headers.b']);
    const key = s('GET', '/x', { a: '1', b: '2' });
    expect(key.split('|').length).toBe(3); // method:url + path1 + path2
  });

  it('non-string values are JSON-serialized', () => {
    const s = createDotNotationKeyStrategy(['body.flag']);
    expect(s('GET', '/x', undefined, { flag: true })).toContain('true');
  });
});

describe('createHashedKeyStrategy', () => {
  it('returns deterministic hash for same input', () => {
    const s = createHashedKeyStrategy((input) => `h${input.length}`);
    const a = s('GET', '/x', { 'x-id': '1' });
    const b = s('GET', '/x', { 'x-id': '1' });
    expect(a).toBe(b);
  });

  it('different inputs → different hashes', () => {
    const s = createHashedKeyStrategy((input) => `h${input.length}`);
    expect(s('GET', '/a')).not.toBe(s('GET', '/abc'));
  });

  it('handles all undefined inputs', () => {
    const s = createHashedKeyStrategy(() => 'fixed');
    expect(s('GET', '/x')).toBe('fixed');
  });
});

describe('combineKeyStrategies', () => {
  it('joins outputs of strategies with |', () => {
    const a = () => 'A';
    const b = () => 'B';
    expect(combineKeyStrategies(a, b)('GET', '/x')).toBe('A|B');
  });

  it('single strategy returns its output', () => {
    expect(combineKeyStrategies(() => 'only')('GET', '/x')).toBe('only');
  });

  it('empty strategy list returns empty string', () => {
    expect(combineKeyStrategies()('GET', '/x')).toBe('');
  });
});
