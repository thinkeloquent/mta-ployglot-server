// @ts-nocheck
import { Dispatcher, Pool, BalancedPool } from 'undici';
import type { AsyncClientOptions } from './options.js';
import { AsyncClient } from './client.js';
import logger from '../logger.js';

const _log = logger.create('@polyglot/fetch-http-client', 'client/pool_client.ts');
void _log;

export enum PoolType {
  POOL = 'pool',
  BALANCED = 'balanced',
  ROUND_ROBIN = 'round-robin',
}

export interface PoolOptions {
  origins?: string | string[];
  type?: PoolType | string;
  connections?: number;
  keepAliveTimeout?: number;
  allowH2?: boolean;
  headersTimeout?: number;
  bodyTimeout?: number;
  pipelining?: number;
}

export interface AsyncClientPoolOptions extends AsyncClientOptions {
  pool?: PoolOptions;
}

class NoCloseDispatcher extends Dispatcher {
  private readonly _target: Dispatcher;
  constructor(target: Dispatcher) {
    super();
    this._target = target;
  }
  override dispatch(
    opts: Dispatcher.DispatchOptions,
    handler: Dispatcher.DispatchHandler,
  ): boolean {
    return this._target.dispatch(opts, handler);
  }
  override async close(): Promise<void> {
    /* no-op */
  }
  override async destroy(): Promise<void> {
    /* no-op */
  }
}

// Re-export RoundRobinPool from undici if present; fall back to BalancedPool when not.
const undiciAny = await import('undici');
const RoundRobinPoolImpl: typeof BalancedPool =
  (undiciAny as unknown as { RoundRobinPool?: typeof BalancedPool }).RoundRobinPool ?? BalancedPool;

export const RoundRobinPool = RoundRobinPoolImpl;
export type AnyPool = Pool | BalancedPool | InstanceType<typeof RoundRobinPoolImpl>;

export function normalizePoolType(type?: PoolType | string): PoolType {
  if (!type) return PoolType.POOL;
  const lower = String(type).toLowerCase();
  if (lower === 'balanced') return PoolType.BALANCED;
  if (lower === 'round-robin' || lower === 'rr') return PoolType.ROUND_ROBIN;
  if (lower === 'pool') return PoolType.POOL;
  return PoolType.POOL;
}

export class AsyncClientPool extends AsyncClient {
  private _pool: AnyPool | null = null;
  private _poolType: PoolType = PoolType.POOL;
  private _upstreams: string[] = [];

  constructor(options: AsyncClientPoolOptions = {}) {
    const protectedMounts: Record<string, Dispatcher> = {};
    if (options.mounts) {
      for (const [pattern, dispatcher] of Object.entries(options.mounts)) {
        protectedMounts[pattern] = new NoCloseDispatcher(dispatcher);
      }
    }
    super({ ...options, mounts: protectedMounts });

    if (options.pool?.origins) {
      this._createPool(options.pool);
    }
  }

  private _createPool(poolOptions: PoolOptions): void {
    const type = normalizePoolType(poolOptions.type);
    const origins = Array.isArray(poolOptions.origins)
      ? poolOptions.origins
      : poolOptions.origins
        ? [poolOptions.origins]
        : [];
    if (origins.length === 0) return;

    const undiciOpts: Pool.Options = {};
    if (poolOptions.connections !== undefined) undiciOpts.connections = poolOptions.connections;
    if (poolOptions.keepAliveTimeout !== undefined)
      undiciOpts.keepAliveTimeout = poolOptions.keepAliveTimeout;
    if (poolOptions.allowH2 !== undefined) undiciOpts.allowH2 = poolOptions.allowH2;
    if (poolOptions.headersTimeout !== undefined)
      undiciOpts.headersTimeout = poolOptions.headersTimeout;
    if (poolOptions.bodyTimeout !== undefined) undiciOpts.bodyTimeout = poolOptions.bodyTimeout;
    if (poolOptions.pipelining !== undefined) undiciOpts.pipelining = poolOptions.pipelining;

    if (type === PoolType.BALANCED || origins.length > 1) {
      this._pool = new BalancedPool(origins, undiciOpts);
      this._poolType = PoolType.BALANCED;
    } else if (type === PoolType.ROUND_ROBIN) {
      this._pool = new RoundRobinPoolImpl(origins[0]!, undiciOpts) as AnyPool;
      this._poolType = PoolType.ROUND_ROBIN;
    } else {
      this._pool = new Pool(origins[0]!, undiciOpts);
      this._poolType = PoolType.POOL;
    }
    this._upstreams = [...origins];
  }

  get poolType(): PoolType {
    return this._poolType;
  }
  get pool(): AnyPool | null {
    return this._pool;
  }

  get stats(): unknown {
    if (!this._pool) return null;
    return (this._pool as { stats?: unknown }).stats ?? null;
  }

  get upstreams(): string[] | null {
    return this._upstreams.length > 0 ? [...this._upstreams] : null;
  }

  addUpstream(upstream: string | URL): this {
    const s = upstream instanceof URL ? upstream.origin : upstream;
    this._upstreams.push(s);
    if (this._poolType === PoolType.BALANCED && this._pool) {
      (this._pool as BalancedPool).addUpstream(s);
    }
    return this;
  }

  removeUpstream(upstream: string | URL): this {
    const s = upstream instanceof URL ? upstream.origin : upstream;
    this._upstreams = this._upstreams.filter((u) => u !== s);
    if (this._poolType === PoolType.BALANCED && this._pool) {
      (this._pool as BalancedPool).removeUpstream(s);
    }
    return this;
  }

  override async close(): Promise<void> {
    if (this._pool) {
      const pool = this._pool;
      this._pool = null;
      await pool.close();
    }
    await super.close();
  }
}

export function createPool(origin: string | URL, options?: Pool.Options): Pool {
  return new Pool(origin instanceof URL ? origin.origin : origin, options);
}

export function createBalancedPool(
  origins: (string | URL)[],
  options?: Pool.Options,
): BalancedPool {
  const strs = origins.map((o) => (o instanceof URL ? o.origin : o));
  return new BalancedPool(strs, options);
}

export function createRoundRobinPool(
  origin: string | URL,
  options?: Pool.Options,
): InstanceType<typeof RoundRobinPoolImpl> {
  return new RoundRobinPoolImpl(
    origin instanceof URL ? origin.origin : origin,
    options,
  ) as InstanceType<typeof RoundRobinPoolImpl>;
}
