// @ts-nocheck
import { Auth } from './base.js';
import type { Request } from '../models/request.js';

type TokenProvider = string | (() => string | Promise<string>);

export class BearerAuth extends Auth {
  private readonly _tokenProvider: TokenProvider;
  private _isAsync: boolean | null = null;

  constructor(token: TokenProvider) {
    super();
    this._tokenProvider = token;
  }

  private _resolveToken(): string | Promise<string> {
    if (typeof this._tokenProvider === 'string') return this._tokenProvider;
    return this._tokenProvider();
  }

  get isAsync(): boolean {
    if (this._isAsync !== null) return this._isAsync;
    if (typeof this._tokenProvider !== 'function') {
      this._isAsync = false;
      return false;
    }
    const probe = this._tokenProvider();
    this._isAsync = probe instanceof Promise;
    return this._isAsync;
  }

  apply(request: Request): Request {
    if (typeof this._tokenProvider === 'function') {
      const probe = this._tokenProvider();
      if (probe instanceof Promise) {
        throw new Error('BearerAuth provider is async, use applyAsync()');
      }
      this.logApply('bearer');
      const cloned = request.clone();
      cloned.headers.set('Authorization', `Bearer ${probe}`);
      return cloned;
    }
    this.logApply('bearer');
    const cloned = request.clone();
    cloned.headers.set('Authorization', `Bearer ${this._tokenProvider}`);
    return cloned;
  }

  async applyAsync(request: Request): Promise<Request> {
    const token = await this._resolveToken();
    this.logApply('bearer-async');
    const cloned = request.clone();
    cloned.headers.set('Authorization', `Bearer ${token}`);
    return cloned;
  }
}

export class APIKeyAuth extends Auth {
  private readonly _apiKey: string;
  private readonly _headerName: string;

  constructor(apiKey: string, headerName: string = 'X-API-Key') {
    super();
    this._apiKey = apiKey;
    this._headerName = headerName;
  }

  apply(request: Request): Request {
    this.logApply('api-key', { headerName: this._headerName });
    const cloned = request.clone();
    cloned.headers.set(this._headerName, this._apiKey);
    return cloned;
  }
}
