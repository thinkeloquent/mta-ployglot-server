// @ts-nocheck
import type { Request } from '../models/request.js';
import { HTTPError } from './base.js';
import {
  TransportError,
  TimeoutError,
  ConnectTimeoutError,
  ReadTimeoutError,
  ConnectError,
  SocketError,
  DNSError,
  NetworkError,
  TLSError,
  ProxyError,
} from './transport.js';

export * from './base.js';
export * from './transport.js';
export * from './status.js';
export * from './stream.js';

const TLS_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

interface ErrorLike {
  name?: string;
  code?: string;
  message?: string;
  hostname?: string;
}

export function mapUndiciError(error: unknown, request?: Request): HTTPError {
  if (error instanceof HTTPError) return error;
  if (error === null || typeof error !== 'object') {
    return new TransportError(String(error), request);
  }

  const err = error as ErrorLike;
  const name = err.name ?? '';
  const code = err.code ?? '';
  const msg = err.message ?? '';

  if (name === 'AbortError') {
    return new NetworkError('Request aborted', request);
  }

  switch (code) {
    case 'UND_ERR_HEADERS_TIMEOUT':
      return new ReadTimeoutError('Headers timeout', request);
    case 'UND_ERR_BODY_TIMEOUT':
      return new ReadTimeoutError('Body timeout', request);
    case 'UND_ERR_CONNECT_TIMEOUT':
      return new ConnectTimeoutError('Connect timeout', request);
    case 'UND_ERR_SOCKET':
      return new SocketError(msg || 'Socket error', request);
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':
      return new ReadTimeoutError(msg || 'Timeout', request);
    case 'ECONNREFUSED':
      return new ConnectError('Connection refused', request, 'ECONNREFUSED');
    case 'ECONNRESET':
      return new SocketError('Connection reset', request);
    case 'EPIPE':
      return new SocketError('Broken pipe', request);
    case 'ECONNABORTED':
      return new SocketError('Connection aborted', request);
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return new DNSError(err.hostname ?? 'unknown', request);
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return new NetworkError(msg || 'Host unreachable', request);
  }

  if (code.startsWith('UND_ERR_')) {
    return new TransportError(msg || code, request);
  }

  if (TLS_CODES.has(code)) {
    return new TLSError(msg || code, request);
  }

  if (/proxy/i.test(msg)) return new ProxyError(msg, request);
  if (/tls|ssl|certificate/i.test(msg)) return new TLSError(msg, request);
  if (/timeout/i.test(msg)) return new ReadTimeoutError(msg, request);

  return new TransportError(msg || 'Transport error', request);
}

export function isTimeoutError(e: unknown): e is TimeoutError {
  return e instanceof TimeoutError;
}
export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError;
}
export function isTransportError(e: unknown): e is TransportError {
  return e instanceof TransportError;
}
export function isHTTPError(e: unknown): e is HTTPError {
  return e instanceof HTTPError;
}
