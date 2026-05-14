// @ts-nocheck
import logger, { type Logger } from '../logger.js';
import { AsyncClient } from '../client/client.js';
import type { RequestOptions } from '../client/options.js';
import { Auth, NoAuth } from '../auth/base.js';
import { BasicAuth } from '../auth/basic.js';
import { BearerAuth, APIKeyAuth } from '../auth/bearer.js';
import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitBreakerConfig,
} from '../retry/circuit-breaker.js';
import {
  JitterStrategy,
  calculateDelay,
  parseRetryAfter,
  shouldRetryMethod,
} from '../retry/jitter.js';
import { isRetryableError, type RetryConfig } from '../retry/config.js';
import type { Response } from '../models/response.js';

export interface SDKAuthConfig {
  type: 'basic' | 'bearer' | 'api-key' | 'custom';
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  headerName?: string;
  auth?: Auth;
}

export interface SDKConfig {
  baseUrl: string;
  auth?: SDKAuthConfig;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  retryBackoff?: number;
  maxRetryDelay?: number;
  jitter?: JitterStrategy;
  retryOnStatus?: number[];
  retryOnException?: boolean;
  respectRetryAfter?: boolean;
  retryMethods?: string[];
  circuitBreaker?: CircuitBreakerConfig;
  logger?: Logger;
}

export interface SDKResponse<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
  headers: Record<string, string | string[]>;
  duration: number;
}

export class SDK {
  private readonly _client: AsyncClient;
  private readonly _logger: Logger;
  private readonly _circuitBreaker: CircuitBreaker | null;
  private readonly _maxRetries: number;
  private readonly _retryDelay: number;
  private readonly _retryBackoff: number;
  private readonly _maxRetryDelay: number;
  private readonly _jitter: JitterStrategy;
  private readonly _retryOnStatus: number[];
  private readonly _retryOnException: boolean;
  private readonly _respectRetryAfter: boolean;
  private readonly _retryMethods?: string[];

  constructor(config: SDKConfig) {
    this._logger = config.logger ?? logger.create('@polyglot/fetch-http-client', 'sdk/core.ts');
    this._maxRetries = config.maxRetries ?? 3;
    this._retryDelay = config.retryDelay ?? 1000;
    this._retryBackoff = config.retryBackoff ?? 2;
    this._maxRetryDelay = config.maxRetryDelay ?? 30000;
    this._jitter = config.jitter ?? JitterStrategy.FULL;
    this._retryOnStatus = config.retryOnStatus ?? [429, 502, 503, 504];
    this._retryOnException = config.retryOnException ?? true;
    this._respectRetryAfter = config.respectRetryAfter ?? true;
    if (config.retryMethods) this._retryMethods = config.retryMethods;
    this._circuitBreaker = config.circuitBreaker ? new CircuitBreaker(config.circuitBreaker) : null;
    this._client = new AsyncClient({
      baseUrl: config.baseUrl,
      auth: this._buildAuth(config.auth),
      timeout: config.timeout ?? 30000,
      logger: this._logger,
    });
  }

  private _buildAuth(auth?: SDKAuthConfig): Auth {
    if (!auth) return new NoAuth();
    switch (auth.type) {
      case 'basic':
        return new BasicAuth(auth.username ?? '', auth.password ?? '');
      case 'bearer':
        return new BearerAuth(auth.token ?? '');
      case 'api-key':
        return new APIKeyAuth(auth.apiKey ?? '', auth.headerName);
      case 'custom':
        return auth.auth ?? new NoAuth();
    }
  }

  get circuitBreaker(): CircuitBreaker | null {
    return this._circuitBreaker;
  }

  async get<T>(url: string | URL, options?: RequestOptions): Promise<SDKResponse<T>> {
    return this._request<T>('GET', url, options);
  }
  async post<T>(url: string | URL, options?: RequestOptions): Promise<SDKResponse<T>> {
    return this._request<T>('POST', url, options);
  }
  async put<T>(url: string | URL, options?: RequestOptions): Promise<SDKResponse<T>> {
    return this._request<T>('PUT', url, options);
  }
  async patch<T>(url: string | URL, options?: RequestOptions): Promise<SDKResponse<T>> {
    return this._request<T>('PATCH', url, options);
  }
  async delete<T>(url: string | URL, options?: RequestOptions): Promise<SDKResponse<T>> {
    return this._request<T>('DELETE', url, options);
  }

  async close(): Promise<void> {
    await this._client.close();
  }

  private async _request<T>(
    method: string,
    url: string | URL,
    options?: RequestOptions,
  ): Promise<SDKResponse<T>> {
    const startTime = Date.now();
    if (this._circuitBreaker && !this._circuitBreaker.allowRequest()) {
      return {
        success: false,
        statusCode: 0,
        error: 'Circuit breaker is open',
        headers: {},
        duration: 0,
      };
    }
    const canRetry = shouldRetryMethod(
      method,
      options?.headers as Record<string, string> | undefined,
      this._retryMethods,
    );
    let lastDelay = 0;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        const response = await this._client.request(method, url, options);
        const formatted = await this._formatResponse<T>(response, Date.now() - startTime);
        if (
          this._retryOnStatus.includes(response.statusCode) &&
          attempt < this._maxRetries &&
          canRetry
        ) {
          let delay = calculateDelay(
            attempt,
            this._retryDelay,
            this._retryBackoff,
            this._maxRetryDelay,
            this._jitter,
            lastDelay,
          );
          if (this._respectRetryAfter) {
            const ra = parseRetryAfter(response.headers.get('Retry-After') ?? null);
            if (ra !== null) delay = Math.min(ra, this._maxRetryDelay);
          }
          this._circuitBreaker?.recordFailure();
          lastDelay = delay;
          await this._delay(delay);
          continue;
        }
        if (response.ok) this._circuitBreaker?.recordSuccess();
        return formatted;
      } catch (err) {
        lastErr = err;
        this._circuitBreaker?.recordFailure();
        if (
          this._retryOnException &&
          isRetryableError(err) &&
          canRetry &&
          attempt < this._maxRetries
        ) {
          const delay = calculateDelay(
            attempt,
            this._retryDelay,
            this._retryBackoff,
            this._maxRetryDelay,
            this._jitter,
            lastDelay,
          );
          lastDelay = delay;
          await this._delay(delay);
          continue;
        }
        return {
          success: false,
          statusCode: 0,
          error: (err as Error).message ?? String(err),
          headers: {},
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      statusCode: 0,
      error: (lastErr as Error)?.message ?? 'retry exhausted',
      headers: {},
      duration: Date.now() - startTime,
    };
  }

  private async _formatResponse<T>(response: Response, duration: number): Promise<SDKResponse<T>> {
    if (response.ok) {
      const data = await response.json<T>();
      return {
        success: true,
        statusCode: response.statusCode,
        data,
        headers: response.headers.toObject(),
        duration,
      };
    }
    return {
      success: false,
      statusCode: response.statusCode,
      error: `HTTP ${response.statusCode}`,
      headers: response.headers.toObject(),
      duration,
    };
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export function createSDK(config: SDKConfig): SDK {
  return new SDK(config);
}

export { JitterStrategy, CircuitBreaker, CircuitOpenError };
export type { CircuitBreakerConfig, RetryConfig };
