// @ts-nocheck
import { request as undiciRequest, ProxyAgent } from 'undici';
import type { Dispatcher } from 'undici';
import { Readable } from 'node:stream';

import logger, { type Logger } from '../logger.js';
import { Headers, createHeaders, type HeadersInit } from '../models/headers.js';
import { Request, normalizeMethod, type HttpMethod, type RequestBody } from '../models/request.js';
import { Response } from '../models/response.js';
import { mapUndiciError } from '../exceptions/index.js';
import { Auth, NoAuth, isAuth } from '../auth/base.js';
import { BearerAuth } from '../auth/bearer.js';
import { Timeout, createTimeout } from '../config/timeout.js';
import { Limits, createLimits } from '../config/limits.js';
import { TLSConfig, createTLSConfig } from '../config/tls.js';
import { Proxy, getEnvProxy } from '../config/proxy.js';
import { normalizeRetryConfig, isRetryableError, type RetryConfig } from '../retry/config.js';
import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitBreakerConfig,
} from '../retry/circuit-breaker.js';
import { calculateDelay, parseRetryAfter, shouldRetryMethod } from '../retry/jitter.js';
import { DispatcherFactory } from '../transport/dispatcher.js';
import { MountRouter, createMountRouter } from '../transport/router.js';
import { HooksManager, createHooksManager } from '../interceptors/hooks.js';
import { processBody, hasBodyOptions } from '../request/body.js';
import { buildURLWithParams } from '../request/params.js';
import { buildURL } from '../models/url.js';
import {
  normalizeClientOptions,
  normalizeRequestOptions,
  type AsyncClientOptions,
  type RequestOptions,
  type EventHooks,
} from './options.js';
import type { QueryParams } from '../models/url.js';

export class AsyncClient {
  private _logger: Logger;
  private _baseUrl?: URL;
  private _defaultHeaders: Headers;
  private _defaultParams?: QueryParams;
  private _auth: Auth;
  private _timeout: Timeout;
  private _limits: Limits;
  private _tls?: TLSConfig;
  private _http2: boolean;
  private _allowH2: boolean;
  private _maxResponseSize: number;
  private _pipelining: number;
  private _followRedirects: boolean;
  private _maxRedirects: number;
  private _eventHooks: EventHooks;
  private _hooksManager: HooksManager;
  private _dispatcherFactory: DispatcherFactory;
  private _mountRouter: MountRouter;
  private _retry: RetryConfig | null;
  private _lastDelay: number;
  private _circuitBreaker: CircuitBreaker | null;
  private _closed = false;

  constructor(options: AsyncClientOptions = {}) {
    const opts = normalizeClientOptions(options);

    this._logger = opts.logger ?? logger.create('@polyglot/fetch-http-client', 'client/client.ts');
    if (opts.baseUrl !== undefined) {
      this._baseUrl = opts.baseUrl instanceof URL ? opts.baseUrl : new URL(String(opts.baseUrl));
    }
    this._defaultHeaders = createHeaders(opts.headers);
    if (opts.params !== undefined) this._defaultParams = opts.params;
    this._auth = opts.auth ?? new NoAuth();
    this._timeout = opts.timeout instanceof Timeout ? opts.timeout : createTimeout(opts.timeout);
    this._limits =
      opts.limits instanceof Limits ? opts.limits : createLimits(opts.limits as undefined);
    if (opts.tls !== undefined) {
      this._tls =
        opts.tls instanceof TLSConfig ? opts.tls : createTLSConfig(opts.tls as boolean | undefined);
    }
    this._http2 = opts.http2 ?? false;
    this._allowH2 = opts.allowH2 ?? true;
    this._maxResponseSize = opts.maxResponseSize ?? -1;
    this._pipelining = opts.pipelining ?? 1;
    this._followRedirects = opts.followRedirects ?? true;
    this._maxRedirects = opts.maxRedirects ?? 10;
    this._eventHooks = opts.eventHooks ?? {};
    this._hooksManager = createHooksManager(this._eventHooks);

    const dispatcherInit: ConstructorParameters<typeof DispatcherFactory>[0] = {
      timeout: this._timeout,
      limits: this._limits,
      http2: this._http2,
      allowH2: this._allowH2,
      maxResponseSize: this._maxResponseSize,
      pipelining: this._pipelining,
      followRedirects: this._followRedirects,
      maxRedirects: this._maxRedirects,
    };
    if (this._tls) dispatcherInit.tls = this._tls;
    if (opts.connect) dispatcherInit.connect = opts.connect;
    if (opts.interceptors) dispatcherInit.interceptors = opts.interceptors;
    this._dispatcherFactory = new DispatcherFactory(dispatcherInit);
    this._mountRouter = createMountRouter(opts.mounts);

    if (opts.proxy) {
      const proxy = opts.proxy instanceof Proxy ? opts.proxy : new Proxy(opts.proxy);
      const proxyAgent = new ProxyAgent({ uri: proxy.sanitizedUrl });
      this._mountRouter.mount('http://', proxyAgent);
      this._mountRouter.mount('https://', proxyAgent);
      this._logger.debug('proxy configured', { url: proxy.sanitizedUrl });
    } else if (opts.trustEnv) {
      const env = getEnvProxy();
      if (env.http)
        this._mountRouter.mount('http://', new ProxyAgent({ uri: env.http.sanitizedUrl }));
      if (env.https)
        this._mountRouter.mount('https://', new ProxyAgent({ uri: env.https.sanitizedUrl }));
    }

    this._retry = normalizeRetryConfig(opts.retry);
    this._lastDelay = 0;
    this._circuitBreaker = opts.circuitBreaker ? new CircuitBreaker(opts.circuitBreaker) : null;

    this._logger.info('AsyncClient created', {
      baseUrl: this._baseUrl?.toString(),
      hasAuth: isAuth(this._auth) && !(this._auth instanceof NoAuth),
      hasRetry: !!this._retry,
      hasCircuitBreaker: !!this._circuitBreaker,
      http2: this._http2,
      followRedirects: this._followRedirects,
    });
  }

  // ---- private helpers ----

  private _buildUrl(url: string | URL, params?: QueryParams): URL {
    const target = typeof url === 'string' ? url : url.pathname + (url.search ?? '');
    let full: URL;
    if (this._baseUrl) {
      full = buildURL(this._baseUrl, target);
    } else if (typeof url === 'string') {
      full = new URL(url);
    } else {
      full = url;
    }
    if (this._defaultParams) full = buildURLWithParams(full, this._defaultParams);
    if (params) full = buildURLWithParams(full, params);
    return full;
  }

  private _buildHeaders(headers?: HeadersInit): Headers {
    const merged = this._defaultHeaders.clone();
    if (!headers) return merged;
    const provided = headers instanceof Headers ? headers : new Headers(headers);
    for (const [k, v] of provided.entries()) merged.set(k, v);
    return merged;
  }

  private _getDispatcher(url: URL): Dispatcher {
    const mounted = this._mountRouter.getDispatcher(url);
    return mounted ?? this._dispatcherFactory.getDispatcher(url);
  }

  private async _callRequestHooks(request: Request): Promise<void> {
    await this._hooksManager.callRequestHooks(request);
  }

  private async _callResponseHooks(response: Response): Promise<void> {
    await this._hooksManager.callResponseHooks(response);
  }

  private _ensureNotClosed(): void {
    if (this._closed) throw new Error('Client has been closed');
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async _executeRequest(
    method: HttpMethod,
    url: string | URL,
    opts: RequestOptions,
  ): Promise<Response> {
    const startTime = Date.now();
    const fullUrl = this._buildUrl(url, opts.params);
    let headers = this._buildHeaders(opts.headers);
    let body: RequestBody = opts.body ?? null;

    if (hasBodyOptions(opts)) {
      const processed = processBody(opts, headers);
      headers = processed.headers;
      body = processed.body;
    }

    const baseRequest = new Request(method, fullUrl, { headers, body });

    let finalRequest: Request;
    const authToApply = opts.auth !== undefined ? opts.auth : this._auth;
    if (authToApply === null || authToApply === undefined) {
      finalRequest = baseRequest;
    } else if (authToApply instanceof BearerAuth && authToApply.isAsync) {
      finalRequest = await authToApply.applyAsync(baseRequest);
    } else {
      const applied = authToApply.apply(baseRequest);
      finalRequest = applied instanceof Promise ? await applied : applied;
    }

    try {
      await this._callRequestHooks(finalRequest);
      const dispatcher = this._getDispatcher(fullUrl);
      const effectiveTimeout =
        opts.timeout != null && !(opts.timeout instanceof Timeout)
          ? createTimeout(opts.timeout)
          : opts.timeout instanceof Timeout
            ? opts.timeout
            : this._timeout;
      const undiciTimeouts = effectiveTimeout.toUndiciOptions();

      this._logger.debug('outbound request', {
        method,
        url: fullUrl.toString(),
        headers: finalRequest.headers.toObject(),
        hasBody: finalRequest.hasBody,
      });

      const undiciOpts: Parameters<typeof undiciRequest>[1] = {
        method,
        headers: finalRequest.headers.toUndiciHeaders(),
        dispatcher,
      };
      if (finalRequest.body !== null && finalRequest.body !== undefined) {
        undiciOpts.body = finalRequest.body as never;
      }
      if (undiciTimeouts.headersTimeout !== undefined)
        undiciOpts.headersTimeout = undiciTimeouts.headersTimeout;
      if (undiciTimeouts.bodyTimeout !== undefined)
        undiciOpts.bodyTimeout = undiciTimeouts.bodyTimeout;

      const result = await undiciRequest(fullUrl.toString(), undiciOpts);
      const response = new Response({
        statusCode: result.statusCode,
        headers: result.headers as unknown as HeadersInit,
        body: result.body as unknown as Readable,
        request: finalRequest,
      });
      await this._callResponseHooks(response);
      this._logger.debug('request completed', {
        statusCode: response.statusCode,
        durationMs: Date.now() - startTime,
      });
      return response;
    } catch (err) {
      this._logger.debug('request failed', {
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
      });
      throw mapUndiciError(err, baseRequest);
    }
  }

  private async _executeWithRetry(
    method: HttpMethod,
    url: string | URL,
    opts: RequestOptions,
  ): Promise<Response> {
    const retry = this._retry!;
    if (this._circuitBreaker && !this._circuitBreaker.allowRequest()) {
      throw new CircuitOpenError('Circuit is open');
    }
    const canRetry = shouldRetryMethod(
      method,
      opts.headers as Record<string, string>,
      retry.retryMethods,
    );
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
      try {
        const response = await this._executeRequest(method, url, opts);
        if (
          retry.retryOnStatus.includes(response.statusCode) &&
          attempt < retry.maxRetries &&
          canRetry
        ) {
          let delay = calculateDelay(
            attempt,
            retry.retryDelay,
            retry.retryBackoff,
            retry.maxRetryDelay,
            retry.jitter,
            this._lastDelay,
          );
          if (retry.respectRetryAfter) {
            const ra = parseRetryAfter(response.headers.get('Retry-After') ?? null);
            if (ra !== null) delay = Math.min(ra, retry.maxRetryDelay);
          }
          this._circuitBreaker?.recordFailure();
          this._lastDelay = delay;
          await this._delay(delay);
          continue;
        }
        if (response.ok) this._circuitBreaker?.recordSuccess();
        return response;
      } catch (err) {
        lastErr = err;
        this._circuitBreaker?.recordFailure();
        if (
          retry.retryOnException &&
          isRetryableError(err) &&
          canRetry &&
          attempt < retry.maxRetries
        ) {
          const delay = calculateDelay(
            attempt,
            retry.retryDelay,
            retry.retryBackoff,
            retry.maxRetryDelay,
            retry.jitter,
            this._lastDelay,
          );
          this._lastDelay = delay;
          await this._delay(delay);
          continue;
        }
        throw err;
      }
    }

    throw lastErr ?? new Error('retry loop exhausted without result');
  }

  // ---- public API ----

  async request(
    method: string,
    url: string | URL,
    options: RequestOptions = {},
  ): Promise<Response> {
    this._ensureNotClosed();
    const normMethod = normalizeMethod(method);
    const normOpts = normalizeRequestOptions(options);
    if (this._retry == null) return this._executeRequest(normMethod, url, normOpts);
    return this._executeWithRetry(normMethod, url, normOpts);
  }

  async get(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('GET', url, options);
  }
  async post(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('POST', url, options);
  }
  async put(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('PUT', url, options);
  }
  async patch(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('PATCH', url, options);
  }
  async delete(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('DELETE', url, options);
  }
  async head(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('HEAD', url, options);
  }
  async options(url: string | URL, options?: RequestOptions): Promise<Response> {
    return this.request('OPTIONS', url, options);
  }

  async *stream(
    method: string,
    url: string | URL,
    options?: RequestOptions,
  ): AsyncGenerator<Buffer> {
    const response = await this.request(method, url, options);
    yield* response.aiterBytes();
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await Promise.all([this._dispatcherFactory.closeAll(), this._mountRouter.closeAll()]);
    this._logger.debug('AsyncClient closed');
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  get closed(): boolean {
    return this._closed;
  }

  get circuitBreaker(): CircuitBreaker | null {
    return this._circuitBreaker;
  }
}

export const Client = AsyncClient;

export type { CircuitBreakerConfig };
