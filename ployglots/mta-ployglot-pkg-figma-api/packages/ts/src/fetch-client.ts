// @ts-nocheck
/**
 * Pluggable `FetchClient` contract — the only transport surface
 * FigmaClient depends on. The default implementation wraps
 * `@polyglot/fetch-http-client`'s `AsyncClient`; callers can swap in
 * their own `AsyncClient` (or any object conforming to this interface)
 * for BYO compositions.
 */

import { AsyncClient, APIKeyAuth, type Response } from '@polyglot/fetch-http-client';

import { resolveFigmaConfig, type FigmaConfig, type FigmaConfigInput } from './config.js';
import { buildProxy } from './proxy.js';
import { buildFigmaRetryConfig } from './retry.js';

export interface FetchRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  timeout?: number;
}

export interface FetchClient {
  get(path: string, options?: FetchRequestOptions): Promise<Response>;
  post(path: string, options?: FetchRequestOptions): Promise<Response>;
  put(path: string, options?: FetchRequestOptions): Promise<Response>;
  delete(path: string, options?: FetchRequestOptions): Promise<Response>;
  patch(path: string, options?: FetchRequestOptions): Promise<Response>;
  close(): Promise<void>;
}

/**
 * Build the default Figma `FetchClient` from a resolved config.
 *
 * This is the glue between `@polyglot/figma-api` and
 * `@polyglot/fetch-http-client` — swap or subclass it to change
 * transport behavior. The configured AsyncClient already satisfies
 * `FetchClient` (verb methods + close); we return it directly.
 */
export function createDefaultFetchClient(config: FigmaConfig): FetchClient {
  const proxy = buildProxy(config.proxy);
  const retry = buildFigmaRetryConfig(config.retry, {
    forceOverwrite: config.forceOverwriteRetry,
  });
  const client = new AsyncClient({
    baseUrl: config.host,
    auth: new APIKeyAuth(config.token, 'X-Figma-Token'),
    timeout: config.timeoutMs,
    headers: {
      accept: 'application/json',
      'user-agent': `polyglot-figma-api/${process.env.npm_package_version ?? '0.1.0'}`,
      ...config.defaultHeaders,
    },
    ...(proxy ? { proxy } : {}),
    ...(retry === false ? { retry: false } : { retry }),
  });
  return client as unknown as FetchClient;
}

/**
 * Helper for callers composing their own outer `AsyncClient` and
 * wanting a `FetchClient` wrapping it — the "BYO adapter" in the
 * plan's F03/04 story. Use when you need outer retry / circuit
 * breaker / caching on top of the Figma client.
 *
 * @example
 *   const outer = new AsyncClient({
 *     baseUrl: 'https://api.figma.com',
 *     auth: new APIKeyAuth(token, 'X-Figma-Token'),
 *     retry: { maxRetries: 5 },
 *   });
 *   const client = new FigmaClient({
 *     token,
 *     fetchClient: fetchClientFromPolyglot(outer),
 *   });
 */
export function fetchClientFromPolyglot(inner: AsyncClient): FetchClient {
  return inner as unknown as FetchClient;
}

/**
 * Build a ready-to-use default `FetchClient` from a config input —
 * equivalent to `new FigmaClient({...}).fetchClient`, but exposed for
 * callers who want to share one transport across multiple clients.
 */
export function createFigmaFetchClient(input: FigmaConfigInput = {}): FetchClient {
  return createDefaultFetchClient(resolveFigmaConfig(input));
}
