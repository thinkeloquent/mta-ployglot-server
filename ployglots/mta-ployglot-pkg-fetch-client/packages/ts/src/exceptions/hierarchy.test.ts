// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as ex from './index.js';
import {
  HTTPError,
  RequestError,
  InvalidURLError,
  RequestOptionsError,
  TransportError,
  TimeoutError,
  ConnectTimeoutError,
  ReadTimeoutError,
  WriteTimeoutError,
  PoolTimeoutError,
  NetworkError,
  ConnectError,
  SocketError,
  DNSError,
  TLSError,
  ProxyError,
  HTTPStatusError,
  TooManyRedirectsError,
  StreamError,
  StreamConsumedError,
  StreamClosedError,
  StreamDecodeError,
  getStatusText,
} from './index.js';

describe('barrel exports', () => {
  it('exports at least 22 named symbols', () => {
    expect(Object.keys(ex).length).toBeGreaterThanOrEqual(22);
  });

  it('exposes mapUndiciError + 4 type guards + getStatusText', () => {
    expect(typeof ex.mapUndiciError).toBe('function');
    expect(typeof ex.isHTTPError).toBe('function');
    expect(typeof ex.isTimeoutError).toBe('function');
    expect(typeof ex.isNetworkError).toBe('function');
    expect(typeof ex.isTransportError).toBe('function');
    expect(typeof ex.getStatusText).toBe('function');
  });
});

describe('class names match', () => {
  const cases: Array<[string, () => Error]> = [
    ['HTTPError', () => new HTTPError('x')],
    ['RequestError', () => new RequestError('x')],
    ['InvalidURLError', () => new InvalidURLError('bad://')],
    ['RequestOptionsError', () => new RequestOptionsError('x')],
    ['TransportError', () => new TransportError('x')],
    ['TimeoutError', () => new TimeoutError('x')],
    ['ConnectTimeoutError', () => new ConnectTimeoutError()],
    ['ReadTimeoutError', () => new ReadTimeoutError()],
    ['WriteTimeoutError', () => new WriteTimeoutError()],
    ['PoolTimeoutError', () => new PoolTimeoutError()],
    ['NetworkError', () => new NetworkError('x')],
    ['ConnectError', () => new ConnectError('x')],
    ['SocketError', () => new SocketError('x')],
    ['DNSError', () => new DNSError('h')],
    ['TLSError', () => new TLSError('x')],
    ['ProxyError', () => new ProxyError('x')],
    ['HTTPStatusError', () => new HTTPStatusError(404, 'Not Found')],
    ['TooManyRedirectsError', () => new TooManyRedirectsError()],
    ['StreamError', () => new StreamError('x')],
    ['StreamConsumedError', () => new StreamConsumedError()],
    ['StreamClosedError', () => new StreamClosedError()],
    ['StreamDecodeError', () => new StreamDecodeError('x')],
  ];
  for (const [name, factory] of cases) {
    it(`${name}.name === '${name}'`, () => {
      expect(factory().name).toBe(name);
    });
  }
});

describe('inheritance chains', () => {
  it('ConnectTimeoutError → TimeoutError → TransportError → RequestError → HTTPError → Error', () => {
    const e = new ConnectTimeoutError();
    expect(e).toBeInstanceOf(TimeoutError);
    expect(e).toBeInstanceOf(TransportError);
    expect(e).toBeInstanceOf(RequestError);
    expect(e).toBeInstanceOf(HTTPError);
    expect(e).toBeInstanceOf(Error);
  });

  it('ConnectError → NetworkError → TransportError', () => {
    const e = new ConnectError('x');
    expect(e).toBeInstanceOf(NetworkError);
    expect(e).toBeInstanceOf(TransportError);
    expect(e).toBeInstanceOf(HTTPError);
  });

  it('DNSError → NetworkError', () => {
    expect(new DNSError('h')).toBeInstanceOf(NetworkError);
  });

  it('TLSError → TransportError (NOT NetworkError)', () => {
    const e = new TLSError('x');
    expect(e).toBeInstanceOf(TransportError);
    expect(e).not.toBeInstanceOf(NetworkError);
  });

  it('StreamConsumedError → StreamError → HTTPError', () => {
    const e = new StreamConsumedError();
    expect(e).toBeInstanceOf(StreamError);
    expect(e).toBeInstanceOf(HTTPError);
  });

  it('HTTPStatusError → HTTPError, NOT TransportError', () => {
    const e = new HTTPStatusError(500, 'Internal Server Error');
    expect(e).toBeInstanceOf(HTTPError);
    expect(e).not.toBeInstanceOf(TransportError);
  });
});

describe('field accessors', () => {
  it('InvalidURLError preserves .url', () => {
    expect(new InvalidURLError('bad://').url).toBe('bad://');
  });
  it('DNSError preserves .hostname', () => {
    expect(new DNSError('bad.example').hostname).toBe('bad.example');
  });
  it('ConnectError preserves .code', () => {
    expect(new ConnectError('x', undefined, 'ECONNREFUSED').code).toBe('ECONNREFUSED');
  });
  it('TimeoutError preserves .timeoutMs', () => {
    expect(new TimeoutError('x', undefined, 5000).timeoutMs).toBe(5000);
  });
  it('HTTPStatusError preserves status fields', () => {
    const e = new HTTPStatusError(404, 'Not Found');
    expect(e.statusCode).toBe(404);
    expect(e.statusText).toBe('Not Found');
    expect(e.message).toBe('HTTP 404 Not Found');
  });
  it('StreamDecodeError preserves .encoding', () => {
    expect(new StreamDecodeError('x', 'utf-8').encoding).toBe('utf-8');
  });
});

describe('getStatusText table', () => {
  it('common 2xx', () => {
    expect(getStatusText(200)).toBe('OK');
    expect(getStatusText(201)).toBe('Created');
    expect(getStatusText(204)).toBe('No Content');
  });
  it('common 4xx', () => {
    expect(getStatusText(400)).toBe('Bad Request');
    expect(getStatusText(404)).toBe('Not Found');
    expect(getStatusText(429)).toBe('Too Many Requests');
  });
  it("418 I'm a teapot", () => {
    expect(getStatusText(418)).toBe("I'm a teapot");
  });
  it('5xx', () => {
    expect(getStatusText(500)).toBe('Internal Server Error');
    expect(getStatusText(503)).toBe('Service Unavailable');
  });
  it('unknown → "Unknown"', () => {
    expect(getStatusText(999)).toBe('Unknown');
  });
});
