// @ts-nocheck
import type { Request } from '../models/request.js';

export class HTTPError extends Error {
  readonly request?: Request;
  constructor(message: string, request?: Request) {
    super(message);
    this.name = 'HTTPError';
    this.request = request;
  }
}

export class RequestError extends HTTPError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'RequestError';
  }
}

export class InvalidURLError extends RequestError {
  readonly url: string;
  constructor(url: string, request?: Request) {
    super(`Invalid URL: ${url}`, request);
    this.name = 'InvalidURLError';
    this.url = url;
  }
}

export class RequestOptionsError extends RequestError {
  constructor(message: string, request?: Request) {
    super(message, request);
    this.name = 'RequestOptionsError';
  }
}
