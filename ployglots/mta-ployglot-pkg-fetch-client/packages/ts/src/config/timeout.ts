// @ts-nocheck
export interface TimeoutOptions {
  connect?: number | null;
  read?: number | null;
  write?: number | null;
  pool?: number | null;
  headersTimeout?: number | null;
  bodyTimeout?: number | null;
}

export interface UndiciTimeoutOptions {
  headersTimeout?: number;
  bodyTimeout?: number;
  connectTimeout?: number;
}

const DEFAULT_CONNECT = 5000;
const DEFAULT_READ = 30000;
const DEFAULT_WRITE = 30000;
const DEFAULT_POOL = 5000;

function applyDefault(value: number | null | undefined, def: number): number | null {
  if (value === null) return null;
  if (value === undefined) return def;
  return value;
}

export class Timeout {
  readonly connect: number | null;
  readonly read: number | null;
  readonly write: number | null;
  readonly pool: number | null;
  readonly headersTimeout: number | null;
  readonly bodyTimeout: number | null;

  constructor(options: TimeoutOptions = {}) {
    this.connect = applyDefault(options.connect, DEFAULT_CONNECT);
    this.read = applyDefault(options.read, DEFAULT_READ);
    this.write = applyDefault(options.write, DEFAULT_WRITE);
    this.pool = applyDefault(options.pool, DEFAULT_POOL);
    this.headersTimeout = options.headersTimeout === undefined ? null : options.headersTimeout;
    this.bodyTimeout = options.bodyTimeout === undefined ? null : options.bodyTimeout;
  }

  toUndiciOptions(): UndiciTimeoutOptions {
    const out: UndiciTimeoutOptions = {};
    const headers = this.headersTimeout ?? this.read;
    const body = this.bodyTimeout ?? this.read;
    if (headers !== null) out.headersTimeout = headers;
    if (body !== null) out.bodyTimeout = body;
    if (this.connect !== null) out.connectTimeout = this.connect;
    return out;
  }

  merge(options: TimeoutOptions = {}): Timeout {
    return new Timeout({
      connect: options.connect !== undefined ? options.connect : this.connect,
      read: options.read !== undefined ? options.read : this.read,
      write: options.write !== undefined ? options.write : this.write,
      pool: options.pool !== undefined ? options.pool : this.pool,
      headersTimeout:
        options.headersTimeout !== undefined ? options.headersTimeout : this.headersTimeout,
      bodyTimeout: options.bodyTimeout !== undefined ? options.bodyTimeout : this.bodyTimeout,
    });
  }

  get isDisabled(): boolean {
    return this.read === null && this.write === null && this.connect === null;
  }
}

export function createTimeout(input?: number | TimeoutOptions): Timeout {
  if (input === undefined) return new Timeout();
  if (typeof input === 'number') {
    return new Timeout({ connect: input, read: input, write: input, pool: input });
  }
  return new Timeout(input);
}
