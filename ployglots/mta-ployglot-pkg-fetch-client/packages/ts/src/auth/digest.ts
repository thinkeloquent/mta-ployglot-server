// @ts-nocheck
import { createHash, randomBytes } from 'node:crypto';
import { Auth } from './base.js';
import type { Request } from '../models/request.js';
import type { Response } from '../models/response.js';

interface DigestChallenge {
  realm: string;
  nonce: string;
  opaque?: string;
  qop?: string;
  algorithm?: string;
  stale?: string;
  domain?: string;
}

export class DigestAuth extends Auth {
  private readonly _username: string;
  private readonly _password: string;
  private _challenge: DigestChallenge | null = null;
  private _nc: number = 0;
  private _cnonce: string = '';

  constructor(username: string, password: string) {
    super();
    this._username = username;
    this._password = password;
  }

  override get requiresChallenge(): boolean {
    return true;
  }

  override canHandleChallenge(response: Response): boolean {
    const wa = response.headers.get('www-authenticate');
    return Boolean(wa && /^digest\b/i.test(wa));
  }

  apply(request: Request, response?: Response): Request {
    if (response && this.canHandleChallenge(response)) {
      this._parseChallenge(response);
    }
    if (this._challenge === null) {
      return request;
    }
    this._nc += 1;
    this._cnonce = randomBytes(16).toString('hex');
    const value = this._computeAuthHeader(request);
    const cloned = request.clone();
    cloned.headers.set('Authorization', value);
    this.logApply('digest', { nc: this._nc });
    return cloned;
  }

  private _parseChallenge(response: Response): void {
    const wa = response.headers.get('www-authenticate');
    if (!wa) return;
    const idx = wa.toLowerCase().indexOf('digest');
    if (idx < 0) return;
    const params = wa.slice(idx + 'digest'.length).trim();
    const parsed: Record<string, string> = {};

    let i = 0;
    while (i < params.length) {
      while (i < params.length && (params[i] === ' ' || params[i] === ',')) i++;
      const eqIdx = params.indexOf('=', i);
      if (eqIdx < 0) break;
      const key = params.slice(i, eqIdx).trim().toLowerCase();
      i = eqIdx + 1;
      let value: string;
      if (params[i] === '"') {
        i++;
        const endIdx = params.indexOf('"', i);
        value = params.slice(i, endIdx);
        i = endIdx + 1;
      } else if (params[i] === "'") {
        i++;
        const endIdx = params.indexOf("'", i);
        value = params.slice(i, endIdx);
        i = endIdx + 1;
      } else {
        const commaIdx = params.indexOf(',', i);
        const endIdx = commaIdx < 0 ? params.length : commaIdx;
        value = params.slice(i, endIdx).trim();
        i = endIdx;
      }
      parsed[key] = value;
    }

    if (!parsed.realm || !parsed.nonce) return;
    const challenge: DigestChallenge = {
      realm: parsed.realm,
      nonce: parsed.nonce,
    };
    if (parsed.opaque) challenge.opaque = parsed.opaque;
    if (parsed.qop) challenge.qop = parsed.qop;
    if (parsed.algorithm) challenge.algorithm = parsed.algorithm;
    if (parsed.stale) challenge.stale = parsed.stale;
    if (parsed.domain) challenge.domain = parsed.domain;
    this._challenge = challenge;
    this._nc = 0;
  }

  private _computeAuthHeader(request: Request): string {
    const challenge = this._challenge!;
    const algorithm = challenge.algorithm ?? 'MD5';
    const qop = (challenge.qop ?? '').split(',')[0]?.trim() ?? '';
    const useQop = qop === 'auth';

    const ha1 = this._computeHA1(algorithm, challenge);
    const uri = request.path;
    const ha2 = this._computeHA2(request.method, uri, algorithm);
    const ncStr = this._nc.toString(16).padStart(8, '0');

    let response: string;
    if (useQop) {
      response = this._hash(
        algorithm,
        `${ha1}:${challenge.nonce}:${ncStr}:${this._cnonce}:auth:${ha2}`,
      );
    } else {
      response = this._hash(algorithm, `${ha1}:${challenge.nonce}:${ha2}`);
    }

    const parts: string[] = [
      `username="${this._username}"`,
      `realm="${challenge.realm}"`,
      `nonce="${challenge.nonce}"`,
      `uri="${uri}"`,
      `algorithm=${algorithm}`,
      `response="${response}"`,
    ];
    if (useQop) {
      parts.push(`qop=auth`);
      parts.push(`nc=${ncStr}`);
      parts.push(`cnonce="${this._cnonce}"`);
    }
    if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);

    return `Digest ${parts.join(', ')}`;
  }

  private _computeHA1(algorithm: string, challenge: DigestChallenge): string {
    const base = this._hash(algorithm, `${this._username}:${challenge.realm}:${this._password}`);
    if (algorithm.toUpperCase().endsWith('-SESS')) {
      return this._hash(algorithm, `${base}:${challenge.nonce}:${this._cnonce}`);
    }
    return base;
  }

  private _computeHA2(method: string, uri: string, algorithm: string): string {
    return this._hash(algorithm, `${method}:${uri}`);
  }

  private _hash(algorithm: string, input: string): string {
    const algo = algorithm.toUpperCase().replace(/-SESS$/, '');
    let nodeAlgo: string;
    switch (algo) {
      case 'MD5':
        nodeAlgo = 'md5';
        break;
      case 'SHA-256':
      case 'SHA256':
        nodeAlgo = 'sha256';
        break;
      case 'SHA-512':
      case 'SHA512':
      case 'SHA-512-256':
        nodeAlgo = 'sha512';
        break;
      default:
        nodeAlgo = 'md5';
    }
    return createHash(nodeAlgo).update(input).digest('hex');
  }

  reset(): void {
    this._challenge = null;
    this._nc = 0;
  }

  get username(): string {
    return this._username;
  }
}
