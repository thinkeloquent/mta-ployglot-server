// @ts-nocheck
import { RequestError } from './base.js';
import type { Request } from '../models/request.js';

export class TransportError extends RequestError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'TransportError';
  }
}

export class TimeoutError extends TransportError {
  readonly timeoutMs?: number;
  constructor(message: string, request?: Request, timeoutMs?: number) {
    super(message, request);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class ConnectTimeoutError extends TimeoutError {
  constructor(message = 'Connect timeout', request?: Request, timeoutMs?: number) {
    super(message, request, timeoutMs);
    this.name = 'ConnectTimeoutError';
  }
}

export class ReadTimeoutError extends TimeoutError {
  constructor(message = 'Read timeout', request?: Request, timeoutMs?: number) {
    super(message, request, timeoutMs);
    this.name = 'ReadTimeoutError';
  }
}

export class WriteTimeoutError extends TimeoutError {
  constructor(message = 'Write timeout', request?: Request, timeoutMs?: number) {
    super(message, request, timeoutMs);
    this.name = 'WriteTimeoutError';
  }
}

export class PoolTimeoutError extends TimeoutError {
  constructor(message = 'Pool timeout', request?: Request, timeoutMs?: number) {
    super(message, request, timeoutMs);
    this.name = 'PoolTimeoutError';
  }
}

export class NetworkError extends TransportError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'NetworkError';
  }
}

export class ConnectError extends NetworkError {
  readonly code?: string;
  constructor(message: string, request?: Request, code?: string) {
    super(message, request);
    this.name = 'ConnectError';
    this.code = code;
  }
}

export class SocketError extends NetworkError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'SocketError';
  }
}

export class DNSError extends NetworkError {
  readonly hostname: string;
  constructor(hostname: string, request?: Request) {
    super(`DNS lookup failed: ${hostname}`, request);
    this.name = 'DNSError';
    this.hostname = hostname;
  }
}

export class TLSError extends TransportError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'TLSError';
  }
}

export class ProxyError extends TransportError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'ProxyError';
  }
}
