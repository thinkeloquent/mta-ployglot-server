// @ts-nocheck
import type { UndiciConnectOptions } from './tls.js';

export interface ProxyAuth {
  username: string;
  password: string;
}

export interface ProxyOptions {
  url: string;
  auth?: ProxyAuth;
  noProxy?: string[];
  tls?: UndiciConnectOptions;
}

export interface UndiciProxyOptions {
  uri: string;
  token?: string;
  requestTls?: UndiciConnectOptions;
}

export class Proxy {
  readonly url: string;
  readonly auth?: ProxyAuth;
  readonly noProxy: string[];
  readonly tls?: UndiciConnectOptions;

  constructor(input: string | ProxyOptions) {
    const options: ProxyOptions = typeof input === 'string' ? { url: input } : input;
    this.url = options.url;
    this.noProxy = options.noProxy ?? [];

    if (options.auth) {
      this.auth = options.auth;
    } else {
      const fromUrl = this._extractAuthFromUrl(options.url);
      if (fromUrl) this.auth = fromUrl;
    }
    if (options.tls) this.tls = options.tls;
  }

  private _extractAuthFromUrl(url: string): ProxyAuth | undefined {
    try {
      const parsed = new URL(url);
      if (parsed.username) {
        return {
          username: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
        };
      }
    } catch {
      // Ignore - URL may be malformed; let downstream surface the error.
    }
    return undefined;
  }

  get sanitizedUrl(): string {
    try {
      const parsed = new URL(this.url);
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    } catch {
      return this.url;
    }
  }

  toUndiciOptions(): UndiciProxyOptions {
    const out: UndiciProxyOptions = { uri: this.sanitizedUrl };
    if (this.auth) {
      const token =
        'Basic ' + Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');
      out.token = token;
    }
    if (this.tls) out.requestTls = this.tls;
    return out;
  }

  shouldBypass(targetUrl: string | URL): boolean {
    if (this.noProxy.length === 0) return false;
    const u = targetUrl instanceof URL ? targetUrl : new URL(targetUrl);
    const host = u.hostname;
    const port = u.port;

    for (const pattern of this.noProxy) {
      const trimmed = pattern.trim();
      if (!trimmed) continue;
      if (trimmed === '*') return true;

      if (trimmed.startsWith('*.')) {
        const suffix = trimmed.slice(2);
        if (host === suffix || host.endsWith('.' + suffix)) return true;
        continue;
      }

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const phost = trimmed.slice(0, colonIdx);
        const pport = trimmed.slice(colonIdx + 1);
        if (phost === host && pport === port) return true;
        continue;
      }

      if (trimmed === host) return true;
      if (host.endsWith('.' + trimmed)) return true;
    }

    return false;
  }
}

export function createProxy(input?: string | ProxyOptions): Proxy | undefined {
  if (input === undefined) return undefined;
  return new Proxy(input);
}

export function getEnvProxy(): { http?: Proxy; https?: Proxy } {
  const env = process.env;
  const httpUrl = env.HTTP_PROXY ?? env.http_proxy;
  const httpsUrl = env.HTTPS_PROXY ?? env.https_proxy;
  const noProxyRaw = env.NO_PROXY ?? env.no_proxy ?? '';
  const noProxy = noProxyRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const out: { http?: Proxy; https?: Proxy } = {};
  if (httpUrl) {
    const opts: ProxyOptions = { url: httpUrl };
    if (noProxy.length) opts.noProxy = noProxy;
    out.http = new Proxy(opts);
  }
  if (httpsUrl) {
    const opts: ProxyOptions = { url: httpsUrl };
    if (noProxy.length) opts.noProxy = noProxy;
    out.https = new Proxy(opts);
  }
  return out;
}
