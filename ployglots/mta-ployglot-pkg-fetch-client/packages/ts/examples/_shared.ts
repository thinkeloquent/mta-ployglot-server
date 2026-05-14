// @ts-nocheck
/**
 * Shared env + proxy helpers used by every integration example.
 *
 * Convention each example follows:
 *   <SERVICE>_HOST   — API host (override the provider default)
 *   <SERVICE>_USER   — username / email / account id (when applicable)
 *   <SERVICE>_PASS   — password / API token / access key
 *   HTTPS_PROXY / HTTP_PROXY / NO_PROXY — optional forward proxy
 *
 * Proxy contract:
 *   - Every example calls `buildProxy({})`. The empty object means
 *     "auto-detect from HTTPS_PROXY / HTTP_PROXY env vars".
 *   - Pass `{ host, user, pass }` to override explicitly.
 *   - When no proxy is discoverable, `buildProxy(...)` returns `undefined`
 *     and callers MUST omit the `proxy:` field on the client (the
 *     `...(proxy ? { proxy } : {})` spread idiom).
 */
import { Proxy } from '@polyglot/fetch-http-client';

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

/**
 * Explicit proxy options bag. Every field is optional; passing `{}` means
 * "auto-detect from HTTPS_PROXY / HTTP_PROXY".
 */
export interface ProxyOptionsBag {
  host?: string;
  user?: string;
  pass?: string;
}

/**
 * Build an explicit `Proxy` from an options bag with env fallbacks.
 *
 * Call patterns:
 *   - `buildProxy({})`                          — auto-detect from env
 *   - `buildProxy({ host: 'http://p:3128' })`   — explicit host
 *   - `buildProxy({ host, user, pass })`        — full override
 *
 * Returns `undefined` when no proxy host is discoverable.
 */
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

/**
 * Convenience: base64-encode `user:pass` for a raw `Authorization: Basic` header
 * when a provider rejects the WWW-Authenticate round-trip.
 */
export function basicAuthHeader(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`, 'utf-8').toString('base64');
}
