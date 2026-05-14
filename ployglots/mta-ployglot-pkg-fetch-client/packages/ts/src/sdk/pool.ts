// @ts-nocheck
import { Pool } from 'undici';

export interface PoolConfig {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxConnections?: number;
  keepAliveTimeout?: number;
  http2?: boolean;
  pipelining?: number;
}

export interface PoolRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class PoolClient {
  private readonly _pool: Pool;
  private readonly _originHost: string;
  private readonly _defaultHeaders: Record<string, string>;
  private readonly _defaultTimeoutMs: number;
  private _closed = false;

  constructor(originHost: string, config: PoolConfig = {}) {
    this._originHost = originHost;
    this._defaultHeaders = config.headers ?? {};
    this._defaultTimeoutMs = config.timeoutMs ?? 30000;
    this._pool = new Pool(originHost, {
      connections: config.maxConnections ?? 10,
      keepAliveTimeout: config.keepAliveTimeout ?? 30000,
      allowH2: config.http2 ?? false,
      pipelining: config.pipelining ?? 1,
      headersTimeout: this._defaultTimeoutMs,
      bodyTimeout: this._defaultTimeoutMs,
    });
  }

  get originHost(): string {
    return this._originHost;
  }

  private async _doRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: PoolRequestOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...this._defaultHeaders,
      ...(options?.headers ?? {}),
    };
    const isWrite = method !== 'GET' && method !== 'HEAD';
    if (
      isWrite &&
      body != null &&
      !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
    ) {
      headers['content-type'] = 'application/json';
    }
    const serialised = body != null ? JSON.stringify(body) : undefined;
    const timeout = options?.timeoutMs ?? this._defaultTimeoutMs;

    const reqOpts: Parameters<Pool['request']>[0] = {
      path,
      method: method as Parameters<Pool['request']>[0]['method'],
      headers,
      headersTimeout: timeout,
      bodyTimeout: timeout,
    };
    if (serialised !== undefined) reqOpts.body = serialised;

    const result = await this._pool.request(reqOpts);
    if (result.statusCode >= 400) {
      const text = await result.body.text();
      throw new Error(`HTTP ${result.statusCode}: ${text}`);
    }
    return (await result.body.json()) as T;
  }

  async post<T>(path: string, body?: unknown, options?: PoolRequestOptions): Promise<T> {
    return this._doRequest<T>('POST', path, body, options);
  }
  async get<T>(path: string, options?: PoolRequestOptions): Promise<T> {
    return this._doRequest<T>('GET', path, undefined, options);
  }
  async put<T>(path: string, body?: unknown, options?: PoolRequestOptions): Promise<T> {
    return this._doRequest<T>('PUT', path, body, options);
  }
  async patch<T>(path: string, body?: unknown, options?: PoolRequestOptions): Promise<T> {
    return this._doRequest<T>('PATCH', path, body, options);
  }
  async delete<T>(path: string, options?: PoolRequestOptions): Promise<T> {
    return this._doRequest<T>('DELETE', path, undefined, options);
  }
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: PoolRequestOptions,
  ): Promise<T> {
    return this._doRequest<T>(method, path, body, options);
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this._pool.close();
  }

  get closed(): boolean {
    return this._closed;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}

const _poolSingletons: Map<string, PoolClient> = new Map();

function _normalizeOrigin(originHost: string | URL): string {
  if (originHost instanceof URL) return originHost.origin;
  try {
    return new URL(originHost).origin;
  } catch {
    return originHost;
  }
}

export function getPool(originHost: string | URL, config?: PoolConfig): PoolClient {
  const key = _normalizeOrigin(originHost);
  const existing = _poolSingletons.get(key);
  if (existing && !existing.closed) return existing;
  const client = new PoolClient(key, config);
  _poolSingletons.set(key, client);
  return client;
}

export async function closePool(originHost: string | URL): Promise<void> {
  const key = _normalizeOrigin(originHost);
  const existing = _poolSingletons.get(key);
  if (existing) {
    _poolSingletons.delete(key);
    await existing.close();
  }
}

export async function closeAllPools(): Promise<void> {
  const pools = [..._poolSingletons.values()];
  _poolSingletons.clear();
  await Promise.all(pools.map((p) => p.close()));
}

export function getActivePoolOrigins(): string[] {
  return [..._poolSingletons.keys()];
}
