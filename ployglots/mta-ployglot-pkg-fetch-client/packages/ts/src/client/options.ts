// @ts-nocheck
import type { Dispatcher } from 'undici';
import type { Auth } from '../auth/base.js';
import type { Timeout, TimeoutOptions } from '../config/timeout.js';
import type { Limits, LimitsOptions } from '../config/limits.js';
import type { TLSConfig, TLSConfigOptions } from '../config/tls.js';
import type { Proxy, ProxyOptions } from '../config/proxy.js';
import type { RetryConfig } from '../retry/config.js';
import type { CircuitBreakerConfig } from '../retry/circuit-breaker.js';
import type { EventHooksConfig, RequestHook, ResponseHook } from '../interceptors/hooks.js';
import type { Logger } from '../logger.js';
import type { HeadersInit } from '../models/headers.js';
import type { QueryParams } from '../models/url.js';
import type { BodyOptions, FileUpload } from '../request/body.js';
import type { RequestBody } from '../models/request.js';

export interface ConnectOptions {
  [key: string]: unknown;
}

export interface EventHooks extends EventHooksConfig {
  onRequest?: RequestHook | RequestHook[];
  onResponse?: ResponseHook | ResponseHook[];
}

export interface AsyncClientOptions {
  baseUrl?: string | URL;
  base_url?: string | URL;
  headers?: HeadersInit;
  params?: QueryParams;
  auth?: Auth;
  timeout?: number | TimeoutOptions | Timeout;
  limits?: LimitsOptions | Limits;
  tls?: boolean | TLSConfigOptions | TLSConfig;
  verify?: boolean;
  proxy?: string | ProxyOptions | Proxy;
  trustEnv?: boolean;
  trust_env?: boolean;
  http2?: boolean;
  allowH2?: boolean;
  allow_h2?: boolean;
  maxResponseSize?: number;
  max_response_size?: number;
  connect?: ConnectOptions;
  pipelining?: number;
  interceptors?: unknown[];
  followRedirects?: boolean;
  follow_redirects?: boolean;
  maxRedirects?: number;
  max_redirects?: number;
  eventHooks?: EventHooks;
  event_hooks?: EventHooks;
  mounts?: Record<string, Dispatcher>;
  retry?: boolean | Partial<RetryConfig> | null;
  circuitBreaker?: CircuitBreakerConfig;
  circuit_breaker?: CircuitBreakerConfig;
  logger?: Logger;
}

export interface RequestOptions extends BodyOptions {
  headers?: HeadersInit;
  params?: QueryParams;
  timeout?: number | TimeoutOptions | Timeout;
  body?: RequestBody;
  auth?: Auth | null;
  followRedirects?: boolean;
  follow_redirects?: boolean;
  maxRedirects?: number;
  max_redirects?: number;
  files?: FileUpload[];
  cache?: { mode?: string; ttl?: number; key?: string } | false;
}

export function normalizeClientOptions(opts: AsyncClientOptions = {}): AsyncClientOptions {
  const out: AsyncClientOptions = { ...opts };
  if (out.baseUrl === undefined && out.base_url !== undefined) out.baseUrl = out.base_url;
  if (out.trustEnv === undefined && out.trust_env !== undefined) out.trustEnv = out.trust_env;
  if (out.allowH2 === undefined && out.allow_h2 !== undefined) out.allowH2 = out.allow_h2;
  if (out.maxResponseSize === undefined && out.max_response_size !== undefined)
    out.maxResponseSize = out.max_response_size;
  if (out.followRedirects === undefined && out.follow_redirects !== undefined)
    out.followRedirects = out.follow_redirects;
  if (out.maxRedirects === undefined && out.max_redirects !== undefined)
    out.maxRedirects = out.max_redirects;
  if (out.eventHooks === undefined && out.event_hooks !== undefined)
    out.eventHooks = out.event_hooks;
  if (out.circuitBreaker === undefined && out.circuit_breaker !== undefined)
    out.circuitBreaker = out.circuit_breaker;
  if (out.tls === undefined && out.verify !== undefined) {
    out.tls = { verify: out.verify } as TLSConfigOptions;
  }
  return out;
}

export function normalizeRequestOptions(opts: RequestOptions = {}): RequestOptions {
  const out: RequestOptions = { ...opts };
  if (out.followRedirects === undefined && out.follow_redirects !== undefined)
    out.followRedirects = out.follow_redirects;
  if (out.maxRedirects === undefined && out.max_redirects !== undefined)
    out.maxRedirects = out.max_redirects;
  return out;
}
