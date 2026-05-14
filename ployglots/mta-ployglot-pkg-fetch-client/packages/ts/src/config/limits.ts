// @ts-nocheck
export interface LimitsOptions {
  maxConnections?: number;
  maxConnectionsPerHost?: number;
  keepAliveTimeout?: number;
  keepAliveMaxTimeout?: number;
  keepAliveTimeoutThreshold?: number;
  pipelining?: number;
  maxConcurrentStreams?: number;
  maxHeaderSize?: number;
}

export interface UndiciPoolOptions {
  connections?: number;
  keepAliveTimeout?: number;
  keepAliveMaxTimeout?: number;
  keepAliveTimeoutThreshold?: number;
  pipelining?: number;
  maxConcurrentStreams?: number;
  maxHeaderSize?: number;
}

const DEFAULT_MAX_CONNECTIONS = 100;
const DEFAULT_MAX_CONNECTIONS_PER_HOST = 20;
const DEFAULT_KEEP_ALIVE_TIMEOUT = 4000;
const DEFAULT_KEEP_ALIVE_MAX_TIMEOUT = 600000;
const DEFAULT_KEEP_ALIVE_TIMEOUT_THRESHOLD = 1000;
const DEFAULT_PIPELINING = 1;
const DEFAULT_MAX_CONCURRENT_STREAMS = 100;
const DEFAULT_MAX_HEADER_SIZE = 16384;

export class Limits {
  readonly maxConnections: number;
  readonly maxConnectionsPerHost: number;
  readonly keepAliveTimeout: number;
  readonly keepAliveMaxTimeout: number;
  readonly keepAliveTimeoutThreshold: number;
  readonly pipelining: number;
  readonly maxConcurrentStreams: number;
  readonly maxHeaderSize: number;

  constructor(options: LimitsOptions = {}) {
    this.maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
    this.maxConnectionsPerHost = options.maxConnectionsPerHost ?? DEFAULT_MAX_CONNECTIONS_PER_HOST;
    this.keepAliveTimeout = options.keepAliveTimeout ?? DEFAULT_KEEP_ALIVE_TIMEOUT;
    this.keepAliveMaxTimeout = options.keepAliveMaxTimeout ?? DEFAULT_KEEP_ALIVE_MAX_TIMEOUT;
    this.keepAliveTimeoutThreshold =
      options.keepAliveTimeoutThreshold ?? DEFAULT_KEEP_ALIVE_TIMEOUT_THRESHOLD;
    this.pipelining = options.pipelining ?? DEFAULT_PIPELINING;
    this.maxConcurrentStreams = options.maxConcurrentStreams ?? DEFAULT_MAX_CONCURRENT_STREAMS;
    this.maxHeaderSize = options.maxHeaderSize ?? DEFAULT_MAX_HEADER_SIZE;
  }

  toUndiciPoolOptions(): UndiciPoolOptions {
    return {
      connections: this.maxConnections,
      keepAliveTimeout: this.keepAliveTimeout,
      keepAliveMaxTimeout: this.keepAliveMaxTimeout,
      keepAliveTimeoutThreshold: this.keepAliveTimeoutThreshold,
      pipelining: this.pipelining,
      maxConcurrentStreams: this.maxConcurrentStreams,
      maxHeaderSize: this.maxHeaderSize,
    };
  }
}

export function createLimits(input?: LimitsOptions): Limits {
  return new Limits(input);
}
