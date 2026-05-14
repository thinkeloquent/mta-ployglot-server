// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { processBody, hasBodyOptions, buildMultipartFormData } from './body.js';
import { Headers } from '../models/headers.js';
import { RequestOptionsError } from '../exceptions/base.js';
import { Readable } from 'node:stream';

describe('processBody — single body source', () => {
  it('json sets body and content-type', () => {
    const out = processBody({ json: { a: 1 } });
    expect(out.body).toBe('{"a":1}');
    expect(out.headers.get('content-type')).toBe('application/json');
  });

  it('json does not override an existing content-type', () => {
    const headers = new Headers({ 'content-type': 'application/vnd.api+json' });
    const out = processBody({ json: { a: 1 } }, headers);
    expect(out.headers.get('content-type')).toBe('application/vnd.api+json');
  });

  it('data (Record) → URLSearchParams string + form-urlencoded', () => {
    const out = processBody({ data: { k: 'v', n: 1 } });
    expect(out.body).toBe('k=v&n=1');
    expect(out.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
  });

  it('data (URLSearchParams) → its toString()', () => {
    const sp = new URLSearchParams();
    sp.append('a', '1');
    sp.append('a', '2');
    const out = processBody({ data: sp });
    expect(out.body).toBe('a=1&a=2');
    expect(out.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
  });

  it('content (raw) passes through with NO auto content-type', () => {
    const out = processBody({ content: 'raw' });
    expect(out.body).toBe('raw');
    expect(out.headers.has('content-type')).toBe(false);
  });

  it('no body option → null body', () => {
    const out = processBody({});
    expect(out.body).toBeNull();
  });
});

describe('processBody — conflict detection', () => {
  it('json + data → RequestOptionsError', () => {
    expect(() => processBody({ json: {}, data: {} })).toThrow(RequestOptionsError);
  });

  it('json + content → RequestOptionsError', () => {
    expect(() => processBody({ json: {}, content: 'x' })).toThrow(RequestOptionsError);
  });

  it('data + content → RequestOptionsError', () => {
    expect(() => processBody({ data: {}, content: 'x' })).toThrow(RequestOptionsError);
  });

  it('all three → RequestOptionsError', () => {
    expect(() => processBody({ json: {}, data: {}, content: 'x' })).toThrow(RequestOptionsError);
  });
});

describe('hasBodyOptions', () => {
  it('returns true for any non-null/undefined body source', () => {
    expect(hasBodyOptions({ json: {} })).toBe(true);
    expect(hasBodyOptions({ data: {} })).toBe(true);
    expect(hasBodyOptions({ content: 'x' })).toBe(true);
    expect(hasBodyOptions({ content: Buffer.alloc(0) })).toBe(true);
    expect(hasBodyOptions({ files: [{ name: 'a', filename: 'a.txt', content: 'x' }] })).toBe(true);
  });

  it('returns false for nullish/empty options', () => {
    expect(hasBodyOptions({})).toBe(false);
    expect(hasBodyOptions({ json: null, data: undefined })).toBe(false);
    expect(hasBodyOptions({ files: [] })).toBe(false);
  });
});

describe('buildMultipartFormData', () => {
  it('attaches text-content file', () => {
    const out = buildMultipartFormData([{ name: 'file', filename: 'a.txt', content: 'hello' }]);
    expect(out.contentType).toBe('multipart/form-data');
    expect(out.body.has('file')).toBe(true);
  });

  it('attaches Buffer-content file', () => {
    const out = buildMultipartFormData([
      {
        name: 'f',
        filename: 'x.bin',
        content: Buffer.from('abc'),
        contentType: 'application/octet-stream',
      },
    ]);
    expect(out.body.has('f')).toBe(true);
  });

  it('attaches Uint8Array-content file', () => {
    const out = buildMultipartFormData([
      { name: 'f', filename: 'x.bin', content: new Uint8Array([1, 2, 3]) },
    ]);
    expect(out.body.has('f')).toBe(true);
  });

  it('attaches Blob-content file directly', () => {
    const out = buildMultipartFormData([
      { name: 'f', filename: 'x.bin', content: new Blob(['hi']) },
    ]);
    expect(out.body.has('f')).toBe(true);
  });

  it('appends extra data fields when provided', () => {
    const out = buildMultipartFormData([], { greeting: 'hi', count: 1 });
    expect(out.body.get('greeting')).toBe('hi');
    expect(out.body.get('count')).toBe('1');
  });

  it('rejects Readable streams (unsupported)', () => {
    const stream = Readable.from([Buffer.from('x')]);
    expect(() => buildMultipartFormData([{ name: 'f', filename: 'x', content: stream }])).toThrow(
      RequestOptionsError,
    );
  });
});

describe('processBody — files branch', () => {
  it('file array triggers multipart form', () => {
    const out = processBody({
      files: [{ name: 'f', filename: 'x.txt', content: 'hi' }],
    });
    expect(out.headers.get('content-type')).toBe('multipart/form-data');
  });

  it('files + data (Record) merges fields', () => {
    const out = processBody({
      files: [{ name: 'f', filename: 'x.txt', content: 'hi' }],
      data: { extra: 'v' },
    });
    expect(out.headers.get('content-type')).toBe('multipart/form-data');
    expect((out.body as FormData).get('extra')).toBe('v');
  });

  it('files preserves caller content-type if already set', () => {
    const headers = new Headers({ 'content-type': 'multipart/related' });
    const out = processBody({ files: [{ name: 'f', filename: 'x.txt', content: 'hi' }] }, headers);
    expect(out.headers.get('content-type')).toBe('multipart/related');
  });
});
