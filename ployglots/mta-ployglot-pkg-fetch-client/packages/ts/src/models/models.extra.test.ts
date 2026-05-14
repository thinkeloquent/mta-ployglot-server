// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Headers } from './headers.js';
import { Response } from './response.js';
import { addParams, parseURL, getOrigin } from './url.js';

describe('Headers — coverage edge cases', () => {
  it('forEach iterates each value', () => {
    const h = new Headers({ A: '1', B: '2' });
    const seen: Array<[string, string]> = [];
    h.forEach((value, key) => {
      seen.push([key, value]);
    });
    expect(seen.sort()).toEqual([
      ['A', '1'],
      ['B', '2'],
    ]);
  });

  it('forEach receives parent reference', () => {
    const h = new Headers({ A: '1' });
    h.forEach((_v, _k, parent) => {
      expect(parent).toBe(h);
    });
  });

  it('toString emits Name: value newline-joined', () => {
    const h = new Headers({ Host: 'x.test', Accept: '*/*' });
    expect(h.toString()).toBe('Host: x.test\nAccept: */*');
  });

  it('Symbol.iterator delegates to entries', () => {
    const h = new Headers({ A: '1' });
    expect([...h]).toEqual([['A', '1']]);
  });

  it('values() yields each value (multi-value expanded)', () => {
    const h = new Headers([
      ['A', '1'],
      ['A', '2'],
    ]);
    expect([...h.values()]).toEqual(['1', '2']);
  });

  it('keys() yields each unique header name', () => {
    const h = new Headers({ A: '1', B: '2' });
    expect([...h.keys()].sort()).toEqual(['A', 'B']);
  });

  it('toJSON emits string for single value, array for multi-value', () => {
    const h = new Headers([
      ['A', '1'],
      ['B', '2'],
      ['B', '3'],
    ]);
    const j = h.toJSON();
    expect(j.A).toBe('1');
    expect(j.B).toEqual(['2', '3']);
  });

  it('toObject is alias for toJSON', () => {
    const h = new Headers({ A: '1' });
    expect(h.toObject()).toEqual(h.toJSON());
  });

  it('empty Headers — entries is empty iterable', () => {
    expect([...new Headers().entries()]).toEqual([]);
  });

  it('invalid array entries are skipped (defensive)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = new Headers([
      ['A', '1'],
      [42 as any, 'x'],
      ['B', 'b'],
    ] as never);
    expect(h.size).toBe(2);
  });
});

describe('Response — coverage edge cases', () => {
  it('arrayBuffer returns ArrayBuffer', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('xy') });
    const ab = await r.arrayBuffer();
    expect(ab.byteLength).toBe(2);
  });

  it('bytes returns Uint8Array', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('xy') });
    const u8 = await r.bytes();
    expect(u8).toBeInstanceOf(Uint8Array);
    expect(u8.length).toBe(2);
  });

  it('blob returns a Blob with content-type', async () => {
    const r = new Response({
      statusCode: 200,
      body: Buffer.from('hi'),
      headers: { 'content-type': 'text/plain' },
    });
    const b = await r.blob();
    expect(b).toBeInstanceOf(Blob);
    expect(b.type).toBe('text/plain');
  });

  it('contentType getter', () => {
    const r = new Response({
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    expect(r.contentType).toBe('application/json; charset=utf-8');
  });

  it('contentLength getter', () => {
    const r = new Response({ statusCode: 200, headers: { 'content-length': '123' } });
    expect(r.contentLength).toBe(123);
  });

  it('contentLength undefined when missing', () => {
    expect(new Response({ statusCode: 200 }).contentLength).toBeUndefined();
  });

  it('url getter pulls from request.urlString', async () => {
    const { Request } = await import('./request.js');
    const req = new Request('GET', 'http://x.test/p');
    const r = new Response({ statusCode: 200, request: req });
    expect(r.url).toBe('http://x.test/p');
  });

  it('toString format', () => {
    expect(new Response({ statusCode: 200 }).toString()).toBe('Response(status=200)');
  });

  it('isInformational on 1xx', () => {
    expect(new Response({ statusCode: 100 }).isInformational).toBe(true);
    expect(new Response({ statusCode: 199 }).isInformational).toBe(true);
    expect(new Response({ statusCode: 200 }).isInformational).toBe(false);
  });

  it('null body → bodyUsed false initially, true after read', async () => {
    const r = new Response({ statusCode: 204 });
    expect(r.bodyUsed).toBe(false);
    await r.text();
    expect(r.bodyUsed).toBe(true);
  });

  it('aiterText decodes utf-8 by default', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('hello') });
    let collected = '';
    for await (const chunk of r.aiterText()) collected += chunk;
    expect(collected).toBe('hello');
  });

  it('aiterText with explicit encoding', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('hi') });
    let collected = '';
    for await (const chunk of r.aiterText('utf-8')) collected += chunk;
    expect(collected).toBe('hi');
  });

  it('aiterBytes with chunkSize rechunks', async () => {
    const r = new Response({ statusCode: 200, body: Buffer.from('abcdef') });
    const out: Buffer[] = [];
    for await (const c of r.aiterBytes(2)) out.push(c);
    expect(out.length).toBe(3);
    expect(out[0]!.toString()).toBe('ab');
  });

  it('aiterBytes on null body produces no chunks', async () => {
    const r = new Response({ statusCode: 200 });
    const out: Buffer[] = [];
    for await (const c of r.aiterBytes()) out.push(c);
    expect(out).toEqual([]);
  });

  it('raise_for_status is alias for raiseForStatus', () => {
    const r = new Response({ statusCode: 500 });
    expect(() => r.raise_for_status()).toThrow();
  });

  it('raiseForStatus on 200 returns void', () => {
    expect(new Response({ statusCode: 200 }).raiseForStatus()).toBeUndefined();
  });

  it('Buffer/Uint8Array body normalised via Readable.from', async () => {
    const r1 = new Response({ statusCode: 200, body: new Uint8Array([0x68, 0x69]) });
    expect(await r1.text()).toBe('hi');
  });

  it('text() honours charset from content-type', async () => {
    const r = new Response({
      statusCode: 200,
      body: Buffer.from('hi'),
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
    expect(await r.text()).toBe('hi');
  });
});

describe('URL utilities — extra branches', () => {
  it('addParams skips null/undefined values', () => {
    const u = addParams('https://x.test', { a: 1, b: null as never, c: undefined as never });
    expect(u.search).toContain('a=1');
    expect(u.search).not.toContain('b=');
    expect(u.search).not.toContain('c=');
  });

  it('parseURL preserves port + userinfo', () => {
    const c = parseURL('http://u:p@x.test:8080/path?q=1#frag');
    expect(c.protocol).toBe('http:');
    expect(c.hostname).toBe('x.test');
    expect(c.port).toBe(8080);
    expect(c.pathname).toBe('/path');
    expect(c.search).toBe('?q=1');
    expect(c.hash).toBe('#frag');
    expect(c.username).toBe('u');
    expect(c.password).toBe('p');
  });

  it('parseURL omits port when default', () => {
    const c = parseURL('http://x.test/');
    expect(c.port).toBeUndefined();
  });

  it('getOrigin includes non-default port', () => {
    expect(getOrigin('http://x.test:8080/p')).toBe('http://x.test:8080');
  });
});

describe('Response.status / Response.status_code', () => {
  it.each([
    [200, 'OK'],
    [404, 'Not Found'],
    [500, 'Internal Server Error'],
  ])('known code %i -> "%s"', (code, expected) => {
    const r = new Response({ statusCode: code });
    expect(r.status_code).toBe(code);
    expect(r.status).toBe(expected);
    expect(r.statusCode).toBe(code);
  });

  it('unknown code returns a sensible fallback', () => {
    const r = new Response({ statusCode: 799 });
    expect(r.status_code).toBe(799);
    expect(typeof r.status).toBe('string');
    expect(r.status.length).toBeGreaterThan(0);
  });
});
