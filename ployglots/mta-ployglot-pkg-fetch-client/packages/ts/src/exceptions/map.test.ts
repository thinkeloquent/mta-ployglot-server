// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  mapUndiciError,
  isTimeoutError,
  isNetworkError,
  isTransportError,
  isHTTPError,
  HTTPError,
  TransportError,
  ReadTimeoutError,
  ConnectTimeoutError,
  SocketError,
  ConnectError,
  DNSError,
  NetworkError,
  TLSError,
  ProxyError,
} from './index.js';

describe('mapUndiciError', () => {
  it('UND_ERR_HEADERS_TIMEOUT → ReadTimeoutError', () => {
    expect(mapUndiciError({ code: 'UND_ERR_HEADERS_TIMEOUT', message: 'x' })).toBeInstanceOf(
      ReadTimeoutError,
    );
  });
  it('UND_ERR_BODY_TIMEOUT → ReadTimeoutError', () => {
    expect(mapUndiciError({ code: 'UND_ERR_BODY_TIMEOUT' })).toBeInstanceOf(ReadTimeoutError);
  });
  it('UND_ERR_CONNECT_TIMEOUT → ConnectTimeoutError', () => {
    expect(mapUndiciError({ code: 'UND_ERR_CONNECT_TIMEOUT' })).toBeInstanceOf(ConnectTimeoutError);
  });
  it('UND_ERR_SOCKET → SocketError', () => {
    expect(mapUndiciError({ code: 'UND_ERR_SOCKET', message: 's' })).toBeInstanceOf(SocketError);
  });
  it('ECONNREFUSED → ConnectError with code', () => {
    const e = mapUndiciError({ code: 'ECONNREFUSED' }) as ConnectError;
    expect(e).toBeInstanceOf(ConnectError);
    expect(e.code).toBe('ECONNREFUSED');
  });
  it('ETIMEDOUT → ReadTimeoutError', () => {
    expect(mapUndiciError({ code: 'ETIMEDOUT' })).toBeInstanceOf(ReadTimeoutError);
  });
  it('ENOTFOUND → DNSError preserves hostname', () => {
    const e = mapUndiciError({ code: 'ENOTFOUND', hostname: 'bad.example' }) as DNSError;
    expect(e).toBeInstanceOf(DNSError);
    expect(e.hostname).toBe('bad.example');
  });
  it('EHOSTUNREACH → NetworkError', () => {
    expect(mapUndiciError({ code: 'EHOSTUNREACH', message: 'x' })).toBeInstanceOf(NetworkError);
  });
  it('CERT_HAS_EXPIRED → TLSError', () => {
    expect(mapUndiciError({ code: 'CERT_HAS_EXPIRED' })).toBeInstanceOf(TLSError);
  });
  it('AbortError → NetworkError', () => {
    expect(mapUndiciError({ name: 'AbortError' })).toBeInstanceOf(NetworkError);
  });
  it('passes HTTPError through', () => {
    const original = new HTTPError('already');
    expect(mapUndiciError(original)).toBe(original);
  });
  it('non-error wrapped in TransportError', () => {
    expect(mapUndiciError('a string')).toBeInstanceOf(TransportError);
    expect(mapUndiciError(42)).toBeInstanceOf(TransportError);
  });
  it('proxy heuristic → ProxyError', () => {
    expect(mapUndiciError({ message: 'proxy connect failed' })).toBeInstanceOf(ProxyError);
  });
  it('tls heuristic → TLSError', () => {
    expect(mapUndiciError({ message: 'tls handshake failed' })).toBeInstanceOf(TLSError);
  });
  it('timeout heuristic → ReadTimeoutError', () => {
    expect(mapUndiciError({ message: 'request timeout' })).toBeInstanceOf(ReadTimeoutError);
  });
  it('default fallback → TransportError', () => {
    expect(mapUndiciError({ message: 'generic failure' })).toBeInstanceOf(TransportError);
  });
});

describe('type guards', () => {
  it('isTimeoutError', () => {
    expect(isTimeoutError(new ReadTimeoutError())).toBe(true);
    expect(isTimeoutError(new HTTPError('x'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
  it('isNetworkError', () => {
    expect(isNetworkError(new ConnectError('x'))).toBe(true);
    expect(isNetworkError(null)).toBe(false);
  });
  it('isTransportError', () => {
    expect(isTransportError(new TransportError('x'))).toBe(true);
    expect(isTransportError(new HTTPError('x'))).toBe(false);
  });
  it('isHTTPError', () => {
    expect(isHTTPError(new HTTPError('x'))).toBe(true);
    expect(isHTTPError({})).toBe(false);
  });
});
