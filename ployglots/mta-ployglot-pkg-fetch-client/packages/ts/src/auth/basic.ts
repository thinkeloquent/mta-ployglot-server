// @ts-nocheck
import { Auth } from './base.js';
import type { Request } from '../models/request.js';

export class BasicAuth extends Auth {
  private readonly _username: string;
  private readonly _password: string;
  private readonly _token: string;

  constructor(username: string, password: string) {
    super();
    this._username = username;
    this._password = password;
    this._token = Buffer.from(`${username}:${password}`).toString('base64');
  }

  apply(request: Request): Request {
    this.logApply('basic');
    const cloned = request.clone();
    cloned.headers.set('Authorization', `Basic ${this._token}`);
    return cloned;
  }

  get username(): string {
    return this._username;
  }

  equals(other: BasicAuth): boolean {
    return this._username === other._username && this._password === other._password;
  }
}

export function basicAuthFromURL(url: string | URL): BasicAuth | null {
  const u = url instanceof URL ? url : new URL(url);
  if (!u.username) return null;
  return new BasicAuth(decodeURIComponent(u.username), decodeURIComponent(u.password));
}
