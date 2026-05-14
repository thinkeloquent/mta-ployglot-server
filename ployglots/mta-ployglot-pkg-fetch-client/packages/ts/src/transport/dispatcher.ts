// @ts-nocheck
import { Pool, Agent, interceptors } from 'undici';
import type { Dispatcher } from 'undici';
import { Timeout } from '../config/timeout.js';
import { Limits } from '../config/limits.js';
import { TLSConfig } from '../config/tls.js';
import { getOrigin } from '../models/url.js';

export interface DispatcherOptions {
  timeout?: Timeout;
  limits?: Limits;
  tls?: TLSConfig;
  http2?: boolean;
  allowH2?: boolean;
  maxResponseSize?: number;
  connect?: Record<string, unknown>;
  pipelining?: number;
  interceptors?: Array<unknown>;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export class DispatcherFactory {
  private _pools: Map<string, Pool> = new Map();
  private _defaultAgent?: Agent;
  private _options: DispatcherOptions;

  constructor(options: DispatcherOptions = {}) {
    this._options = options;
  }

  getDispatcher(url: string | URL): Dispatcher {
    const origin = getOrigin(url);
    let pool = this._pools.get(origin);
    if (!pool) {
      pool = this._createPool(origin);
      this._pools.set(origin, pool);
    }
    return pool;
  }

  getDefaultAgent(): Agent {
    if (!this._defaultAgent) {
      this._defaultAgent = this._createAgent();
    }
    return this._defaultAgent;
  }

  private _createPool(origin: string): Pool {
    return new Pool(origin, this._buildPoolOptions());
  }

  private _createAgent(): Agent {
    return new Agent(this._buildAgentOptions());
  }

  private _buildPoolOptions(): Pool.Options {
    const opts: Record<string, unknown> = {};
    if (this._options.timeout) {
      Object.assign(opts, this._options.timeout.toUndiciOptions());
    }
    if (this._options.limits) {
      Object.assign(opts, this._options.limits.toUndiciPoolOptions());
    }
    if (this._options.tls) {
      opts.connect = { ...this._options.tls.toUndiciOptions(), ...(this._options.connect ?? {}) };
    } else if (this._options.connect) {
      opts.connect = this._options.connect;
    }
    if (this._options.allowH2 !== undefined) opts.allowH2 = this._options.allowH2;
    if (this._options.maxResponseSize !== undefined)
      opts.maxResponseSize = this._options.maxResponseSize;

    const ic: unknown[] = [];
    if (this._options.followRedirects !== false) {
      const maxRedirections = this._options.maxRedirects ?? 10;
      ic.push(interceptors.redirect({ maxRedirections }));
    }
    if (this._options.interceptors) ic.push(...this._options.interceptors);
    if (ic.length > 0) opts.interceptors = ic;

    return opts as Pool.Options;
  }

  private _buildAgentOptions(): Agent.Options {
    const opts: Record<string, unknown> = {};
    if (this._options.timeout) Object.assign(opts, this._options.timeout.toUndiciOptions());
    if (this._options.tls) opts.connect = this._options.tls.toUndiciOptions();
    if (this._options.allowH2 !== undefined) opts.allowH2 = this._options.allowH2;
    return opts as Agent.Options;
  }

  async closeAll(): Promise<void> {
    const dispatchers: Array<{ close: () => Promise<void> }> = [...this._pools.values()];
    if (this._defaultAgent) dispatchers.push(this._defaultAgent);
    await Promise.all(dispatchers.map((d) => d.close()));
    this._pools.clear();
    this._defaultAgent = undefined;
  }

  get cacheSize(): number {
    return this._pools.size;
  }

  get cachedOrigins(): string[] {
    return [...this._pools.keys()];
  }
}

export function createPool(origin: string | URL, options?: DispatcherOptions): Pool {
  const factory = new DispatcherFactory(options);
  return factory.getDispatcher(origin) as Pool;
}

export function createAgent(options?: DispatcherOptions): Agent {
  return new DispatcherFactory(options).getDefaultAgent();
}
