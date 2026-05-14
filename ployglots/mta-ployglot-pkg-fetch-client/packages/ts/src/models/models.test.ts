// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Headers, createHeaders } from './headers.js';
import { joinURL, addParams, matchURLPattern, isValidURL, getOrigin } from './url.js';
import { Request, normalizeMethod } from './request.js';
import { Response } from './response.js';
import { HTTPStatusError, TooManyRedirectsError } from '../exceptions/status.js';
import { StreamConsumedError } from '../exceptions/stream.js';

describe('Headers', () => {
  it('case-insensitive get/set', () => {
    const h = new Headers({ 'Content-Type': 'application/json' });
    expect(h.get('content-type')).toBe('application/json');
    expect(h.get('CONTENT-TYPE')).toBe('application/json');
  });

  it('append accumulates multi-value headers', () => {
    const h = new Headers();
    h.append('Set-Cookie', 'a');
    h.append('set-cookie', 'b');
    expect(h.getAll('Set-Cookie')).toEqual(['a', 'b']);
  });

  it('parses raw HTTP header string', () => {
    const h = new Headers('Host: example.com\r\nAccept: */*');
    expect(h.get('host')).toBe('example.com');
    expect(h.get('accept')).toBe('*/*');
  });

  it('size counts unique header names', () => {
    const h = new Headers([
      ['A', '1'],
      ['A', '2'],
    ]);
    expect(h.size).toBe(1);
  });

  it('iteration preserves original case', () => {
    const h = new Headers({ 'Content-Type': 'a/b' });
    expect([...h.entries()]).toEqual([['Content-Type', 'a/b']]);
  });

  it('clone is independent', () => {
    const h = new Headers({ A: '1' });
    const c = h.clone();
    c.set('A', '2');
    expect(h.get('A')).toBe('1');
    expect(c.get('A')).toBe('2');
  });

  it('merge overrides', () => {
    const h1 = new Headers({ A: '1', B: '2' });
    const merged = h1.merge({ B: '3', C: '4' });
    expect(merged.get('A')).toBe('1');
    expect(merged.get('B')).toBe('3');
    expect(merged.get('C')).toBe('4');
  });

  it('createHeaders passthrough', () => {
    const h = new Headers({ A: '1' });
    expect(createHeaders(h)).toBe(h);
  });

  it('toUndiciHeaders shape', () => {
    const h = new Headers({ A: '1', B: ['2', '3'] });
    const out = h.toUndiciHeaders();
    expect(out.A).toBe('1');
    expect(out.B).toEqual(['2', '3']);
  });
});

describe('URL utilities', () => {
  it('joinURL strips slashes', () => {
    expect(joinURL('https://x.test/', '/a').toString()).toBe('https://x.test/a');
    expect(joinURL('https://x.test', 'a').toString()).toBe('https://x.test/a');
  });

  it('addParams appends', () => {
    const u = addParams('https://x.test', { a: 1, b: [true, false] });
    expect(u.search).toContain('a=1');
    expect(u.search).toContain('b=true');
    expect(u.search).toContain('b=false');
  });

  it('matchURLPattern wildcard scheme', () => {
    expect(matchURLPattern('https://api.example.com/v1', 'all://*/v1')).toBe(true);
    expect(matchURLPattern('https://api.example.com', 'http://*')).toBe(false);
  });

  it('matchURLPattern wildcard subdomain', () => {
    expect(matchURLPattern('https://api.example.com', 'all://*.example.com')).toBe(true);
  });

  it('isValidURL', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('not-a-url')).toBe(false);
  });

  it('getOrigin', () => {
    expect(getOrigin('https://x.test:8080/a/b')).toBe('https://x.test:8080');
  });
});

describe('Request', () => {
  it('exposes path getter', () => {
    expect(new Request('GET', 'https://x.test/a?b=1').path).toBe('/a?b=1');
  });

  it('clone overrides method', () => {
    const r = new Request('GET', 'https://x.test');
    expect(r.clone({ method: 'POST' }).method).toBe('POST');
  });

  it('toString format', () => {
    expect(new Request('GET', 'https://x.test').toString()).toBe('GET https://x.test/');
  });

  it('normalizeMethod', () => {
    expect(normalizeMethod('get')).toBe('GET');
    expect(() => normalizeMethod('FOO')).toThrow(/Invalid HTTP method/);
  });

  it('toUndiciOptions preserves body', () => {
    expect(new Request('POST', 'https://x.test', { body: 'hi' }).toUndiciOptions().body).toBe('hi');
  });
});

describe('Response', () => {
  it('status predicates', () => {
    expect(new Response({ statusCode: 200 }).ok).toBe(true);
    expect(new Response({ statusCode: 404 }).isClientError).toBe(true);
    expect(new Response({ statusCode: 500 }).isServerError).toBe(true);
    expect(new Response({ statusCode: 302 }).isRedirect).toBe(true);
    expect(new Response({ statusCode: 100 }).isInformational).toBe(true);
  });

  it('reads text body once', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('hi') });
    expect(await r.text()).toBe('hi');
    await expect(r.text()).rejects.toBeInstanceOf(StreamConsumedError);
  });

  it('reads JSON', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('{"a":1}') });
    expect(await r.json<{ a: number }>()).toEqual({ a: 1 });
  });

  it('raiseForStatus on 4xx', () => {
    expect(() => new Response({ statusCode: 404 }).raiseForStatus()).toThrowError(HTTPStatusError);
  });

  it('raiseForStatus passes on 2xx', () => {
    expect(() => new Response({ statusCode: 200 }).raiseForStatus()).not.toThrow();
  });

  it('raiseForStatus throws TooManyRedirects when history overflows', () => {
    const fake = new Request('GET', 'https://x.test');
    expect(() =>
      new Response({
        statusCode: 302,
        redirectHistory: Array(25).fill(fake),
      }).raiseForStatus(),
    ).toThrowError(TooManyRedirectsError);
  });

  it('aiterLines splits correctly', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('a\r\nb\nc') });
    const lines: string[] = [];
    for await (const l of r.aiterLines()) lines.push(l);
    expect(lines).toEqual(['a', 'b', 'c']);
  });
});
