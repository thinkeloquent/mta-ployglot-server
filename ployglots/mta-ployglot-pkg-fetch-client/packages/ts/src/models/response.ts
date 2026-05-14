// @ts-nocheck
import { Readable } from 'node:stream';
import logger from '../logger.js';
import { Headers, createHeaders, type HeadersInit } from './headers.js';
import type { Request } from './request.js';
import { StreamConsumedError } from '../exceptions/stream.js';
import { HTTPStatusError, TooManyRedirectsError, getStatusText } from '../exceptions/status.js';

const _log = logger.create('@polyglot/fetch-http-client', 'models/response.ts');
void _log;

export interface ResponseInit {
  statusCode: number;
  headers?: HeadersInit;
  body?: Readable | Buffer | Uint8Array | null;
  request?: Request;
  redirectHistory?: Request[];
}

const DEFAULT_MAX_REDIRECTS = 20;

export class Response {
  readonly statusCode: number;
  readonly headers: Headers;
  readonly request?: Request;
  readonly redirectHistory: Request[];

  private _body: Readable | null;
  private _bufferedBytes: Buffer | null = null;
  private _consumed = false;

  constructor(init: ResponseInit) {
    this.statusCode = init.statusCode;
    this.headers = createHeaders(init.headers);
    if (init.request !== undefined) this.request = init.request;
    this.redirectHistory = init.redirectHistory ?? [];

    if (init.body === null || init.body === undefined) {
      this._body = null;
    } else if (init.body instanceof Readable) {
      this._body = init.body;
    } else if (Buffer.isBuffer(init.body)) {
      this._body = Readable.from(init.body);
    } else {
      // Uint8Array: Readable.from would iterate as numbers — wrap in Buffer first.
      this._body = Readable.from(Buffer.from(init.body));
    }
  }

  get body(): Readable | null {
    return this._body;
  }

  get bodyUsed(): boolean {
    return this._consumed;
  }

  get ok(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }
  get isSuccess(): boolean {
    return this.ok;
  }
  get isRedirect(): boolean {
    return this.statusCode >= 300 && this.statusCode < 400;
  }
  get isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }
  get isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }
  get isError(): boolean {
    return this.statusCode >= 400;
  }
  get isInformational(): boolean {
    return this.statusCode >= 100 && this.statusCode < 200;
  }

  /**
   * Snake-case alias for `statusCode`. Mirrors the Python twin so cross-language
   * code paths (e.g. polyglot server route handlers) can compare against the
   * same field name.
   */
  get status_code(): number {
    return this.statusCode;
  }

  /**
   * Textual reason phrase for `statusCode` (e.g. "OK", "Not Found"). Note: this
   * intentionally diverges from the Web Fetch API where `Response.status` is the
   * integer; here `Response.status` is the text and `Response.status_code` is the
   * integer.
   */
  get status(): string {
    return getStatusText(this.statusCode);
  }

  get contentType(): string | undefined {
    return this.headers.get('content-type');
  }
  get contentLength(): number | undefined {
    const v = this.headers.get('content-length');
    return v ? parseInt(v, 10) : undefined;
  }
  get url(): string | undefined {
    return this.request?.urlString;
  }

  toString(): string {
    return `Response(status=${this.statusCode})`;
  }

  private _ensureNotConsumed(): void {
    if (this._consumed) throw new StreamConsumedError('Body already consumed', this.request);
  }

  private async _readBuffer(): Promise<Buffer> {
    this._ensureNotConsumed();
    this._consumed = true;
    if (this._body === null) {
      this._bufferedBytes = Buffer.alloc(0);
      return this._bufferedBytes;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of this._body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    this._bufferedBytes = Buffer.concat(chunks);
    return this._bufferedBytes;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const buf = await this._readBuffer();
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(await this._readBuffer());
  }

  async text(encoding?: BufferEncoding): Promise<string> {
    const buf = await this._readBuffer();
    return buf.toString(encoding ?? this._getEncoding(this.contentType));
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text) as T;
  }

  async blob(): Promise<Blob> {
    const buf = await this._readBuffer();
    const type = this.contentType ?? '';
    return new Blob([buf], { type });
  }

  async *aiterBytes(chunkSize?: number): AsyncGenerator<Buffer> {
    this._ensureNotConsumed();
    this._consumed = true;
    if (this._body === null) return;

    if (chunkSize === undefined || chunkSize <= 0) {
      for await (const chunk of this._body) {
        yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
      return;
    }

    let pending = Buffer.alloc(0);
    for await (const chunk of this._body) {
      pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      while (pending.length >= chunkSize) {
        yield pending.subarray(0, chunkSize);
        pending = pending.subarray(chunkSize);
      }
    }
    if (pending.length > 0) yield pending;
  }

  async *aiterText(encoding = 'utf-8'): AsyncGenerator<string> {
    const decoder = new TextDecoder(encoding, { fatal: false });
    for await (const chunk of this.aiterBytes()) {
      const out = decoder.decode(chunk, { stream: true });
      if (out) yield out;
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  }

  async *aiterLines(): AsyncGenerator<string> {
    let buffer = '';
    for await (const text of this.aiterText()) {
      buffer += text;
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, idx);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        yield line;
        buffer = buffer.slice(idx + 1);
      }
    }
    if (buffer.length > 0) yield buffer;
  }

  raiseForStatus(): void {
    const max = DEFAULT_MAX_REDIRECTS;
    if (this.redirectHistory.length > max) {
      throw new TooManyRedirectsError(this.request);
    }
    if (this.isError) {
      throw new HTTPStatusError(this.statusCode, getStatusText(this.statusCode), this.request);
    }
  }

  raise_for_status(): void {
    this.raiseForStatus();
  }

  private _getEncoding(header?: string): BufferEncoding {
    if (!header) return 'utf-8' as BufferEncoding;
    const m = header.match(/charset=([^;\s]+)/i);
    if (!m) return 'utf-8' as BufferEncoding;
    return m[1]!.toLowerCase() as BufferEncoding;
  }
}
