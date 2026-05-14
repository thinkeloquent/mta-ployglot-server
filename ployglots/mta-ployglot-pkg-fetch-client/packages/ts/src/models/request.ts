// @ts-nocheck
import type { Readable } from 'node:stream';
import logger from '../logger.js';
import { Headers, createHeaders, type HeadersInit } from './headers.js';

const _log = logger.create('@polyglot/fetch-http-client', 'models/request.ts');
void _log;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE';

export type RequestBody =
  | string
  | Buffer
  | Uint8Array
  | Readable
  | FormData
  | URLSearchParams
  | null;

export interface RequestOptions {
  headers?: HeadersInit;
  body?: RequestBody;
  timestamp?: Date;
}

export class Request {
  readonly method: HttpMethod;
  readonly url: URL;
  readonly headers: Headers;
  readonly body: RequestBody;
  readonly timestamp: Date;

  constructor(method: HttpMethod, url: string | URL, options: RequestOptions = {}) {
    this.method = method;
    this.url = url instanceof URL ? url : new URL(url);
    this.headers = createHeaders(options.headers);
    this.body = options.body ?? null;
    this.timestamp = options.timestamp ?? new Date();
  }

  get urlString(): string {
    return this.url.toString();
  }
  get origin(): string {
    return this.url.origin;
  }
  get path(): string {
    return this.url.pathname + this.url.search;
  }
  get hasBody(): boolean {
    return this.body !== null && this.body !== undefined;
  }
  get contentType(): string | undefined {
    return this.headers.get('content-type');
  }
  get contentLength(): number | undefined {
    const v = this.headers.get('content-length');
    return v ? parseInt(v, 10) : undefined;
  }

  clone(options: Partial<RequestOptions> & { method?: string; url?: string | URL } = {}): Request {
    const method = (options.method ?? this.method) as HttpMethod;
    const url = options.url ?? this.url;
    const headers = options.headers ?? this.headers.clone();
    return new Request(method, url, {
      headers,
      body: options.body !== undefined ? options.body : this.body,
      timestamp: options.timestamp ?? this.timestamp,
    });
  }

  toUndiciOptions(): {
    method: string;
    headers: Record<string, string | string[]>;
    body: RequestBody;
  } {
    return {
      method: this.method,
      headers: this.headers.toUndiciHeaders(),
      body: this.body,
    };
  }

  toString(): string {
    return `${this.method} ${this.urlString}`;
  }
}

export function normalizeMethod(method: string): HttpMethod {
  const upper = method.toUpperCase();
  const valid: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];
  if (!valid.includes(upper as HttpMethod)) {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  return upper as HttpMethod;
}
