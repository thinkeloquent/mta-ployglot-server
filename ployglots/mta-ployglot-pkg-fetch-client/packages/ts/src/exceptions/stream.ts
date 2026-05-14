// @ts-nocheck
import { HTTPError } from './base.js';
import type { Request } from '../models/request.js';

export class StreamError extends HTTPError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'StreamError';
  }
}

export class StreamConsumedError extends StreamError {
  constructor(message = 'Stream has already been consumed', request?: Request) {
    super(message, request);
    this.name = 'StreamConsumedError';
  }
}

export class StreamClosedError extends StreamError {
  constructor(message = 'Stream has been closed', request?: Request) {
    super(message, request);
    this.name = 'StreamClosedError';
  }
}

export class StreamDecodeError extends StreamError {
  readonly encoding?: string;
  constructor(message: string, encoding?: string, request?: Request) {
    super(message, request);
    this.name = 'StreamDecodeError';
    this.encoding = encoding;
  }
}
