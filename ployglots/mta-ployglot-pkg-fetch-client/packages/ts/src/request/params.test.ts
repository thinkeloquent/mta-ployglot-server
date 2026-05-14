// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { mergeParams, buildURLWithParams, parseQueryString, serializeParams } from './params.js';

describe('mergeParams', () => {
  it('disjoint keys', () => {
    expect(mergeParams({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('overlapping scalar keys: new wins', () => {
    expect(mergeParams({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('array on either side concats', () => {
    expect(mergeParams({ a: [1] }, { a: 2 })).toEqual({ a: [1, 2] });
    expect(mergeParams({ a: 1 }, { a: [2, 3] })).toEqual({ a: [1, 2, 3] });
  });

  it('undefined existing → new wins', () => {
    expect(mergeParams(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeParams({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(mergeParams(undefined, undefined)).toEqual({});
  });
});

describe('buildURLWithParams', () => {
  it('appends query string', () => {
    const u = buildURLWithParams('https://x.test', { a: 1 });
    expect(u.search).toBe('?a=1');
  });

  it('array values produce repeated keys', () => {
    const u = buildURLWithParams('https://x.test', { a: [1, 2] });
    expect(u.search).toBe('?a=1&a=2');
  });

  it('preserves existing params on URL', () => {
    const u = buildURLWithParams(new URL('https://x.test/?a=1'), { b: 2 });
    expect(u.search).toContain('a=1');
    expect(u.search).toContain('b=2');
  });

  it('no params → unchanged', () => {
    expect(buildURLWithParams('https://x.test/p').toString()).toBe('https://x.test/p');
  });
});

describe('parseQueryString', () => {
  it('strips leading ?', () => {
    const q = parseQueryString('?a=1&b=2');
    expect(q.a).toBe('1');
    expect(q.b).toBe('2');
  });

  it('repeated key → array', () => {
    const q = parseQueryString('a=1&a=2&b=3');
    expect(q.a).toEqual(['1', '2']);
    expect(q.b).toBe('3');
  });

  it('empty → {}', () => {
    expect(parseQueryString('')).toEqual({});
  });
});

describe('serializeParams', () => {
  it('basic key=value', () => {
    expect(serializeParams({ a: 1, b: 2 })).toBe('a=1&b=2');
  });

  it('array values produce repeated keys', () => {
    expect(serializeParams({ a: 1, b: [2, 3] })).toBe('a=1&b=2&b=3');
  });

  it('encodes spaces', () => {
    expect(serializeParams({ q: 'hello world' })).toBe('q=hello+world');
  });
});
