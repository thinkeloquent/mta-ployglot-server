// @ts-nocheck
/**
 * Proxy + env helpers — mirror the shape used by the sibling
 * `@polyglot/fetch-http-client` integration examples so FigmaClient
 * and downstream callers share one idiom.
 *
 * Convention each entry point follows:
 *
 *   FIGMA_HOST   — optional override (default https://api.figma.com)
 *   FIGMA_USER   — placeholder (Figma is token-only)
 *   FIGMA_PASS   — required token
 *   HTTPS_PROXY / HTTP_PROXY / NO_PROXY — optional forward proxy
 *
 * Proxy contract:
 *   - `buildProxy({})`                      — auto-detect from env
 *   - `buildProxy({ host: 'http://p:3128' })` — explicit host
 *   - `buildProxy({ host, user, pass })`     — full override
 *   When no proxy is discoverable, returns `undefined` and callers
 *   omit the `proxy:` field on the underlying fetch client.
 */

import { Proxy } from '@polyglot/fetch-http-client';

export interface ProxyOptionsBag {
  host?: string;
  user?: string;
  pass?: string;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.length === 0) {
    throw new Error(
      `Missing env ${name}. Set it in your shell, a .env file, or your secret manager and rerun.`,
    );
  }
  return v;
}

export function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? v : fallback;
}

export function buildProxy(options: ProxyOptionsBag = {}): Proxy | undefined {
  const host = options.host ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (host === undefined || host.length === 0) return undefined;

  const user = options.user ?? process.env.HTTP_PROXY_USER;
  const pass = options.pass ?? process.env.HTTP_PROXY_PASS;

  if (user !== undefined && user.length > 0 && pass !== undefined && pass.length > 0) {
    return new Proxy({ url: host, auth: { username: user, password: pass } });
  }
  return new Proxy({ url: host });
}
