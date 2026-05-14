// @ts-nocheck
// Convenience module-level fns
export {
  get,
  post,
  put,
  patch,
  del,
  head,
  options,
  request,
  closeDefaultClient,
} from './convenience.js';
export { del as delete } from './convenience.js';

// Client
export { AsyncClient, Client } from './client/client.js';
export {
  AsyncClientPool,
  PoolType,
  RoundRobinPool,
  createPool as createClientPool,
  createBalancedPool,
  createRoundRobinPool,
} from './client/pool_client.js';
export type {
  AsyncClientOptions,
  RequestOptions,
  ConnectOptions,
  EventHooks,
} from './client/options.js';
export type { AsyncClientPoolOptions, PoolOptions, AnyPool } from './client/pool_client.js';

// Config
export { Timeout, createTimeout } from './config/timeout.js';
export type { TimeoutOptions, UndiciTimeoutOptions } from './config/timeout.js';
export { Limits, createLimits } from './config/limits.js';
export type { LimitsOptions, UndiciPoolOptions } from './config/limits.js';
export { TLSConfig, createTLSConfig } from './config/tls.js';
export type { TLSConfigOptions, UndiciConnectOptions } from './config/tls.js';
export { Proxy, createProxy, getEnvProxy } from './config/proxy.js';
export type { ProxyOptions, ProxyAuth, UndiciProxyOptions } from './config/proxy.js';

// Auth
export {
  Auth,
  NoAuth,
  isAuth,
  BasicAuth,
  basicAuthFromURL,
  BearerAuth,
  APIKeyAuth,
  DigestAuth,
} from './auth/index.js';

// Models
export { Headers, createHeaders } from './models/headers.js';
export type { HeadersInit } from './models/headers.js';
export { Request, normalizeMethod } from './models/request.js';
export type {
  HttpMethod,
  RequestBody,
  RequestOptions as RequestModelOptions,
} from './models/request.js';
export { Response } from './models/response.js';
export type { ResponseInit } from './models/response.js';
export {
  joinURL,
  addParams,
  buildURL,
  parseURL,
  matchURLPattern,
  getOrigin,
  isValidURL,
} from './models/url.js';
export type { QueryParamValue, QueryParams, URLComponents } from './models/url.js';

// Exceptions
export * from './exceptions/index.js';

// Retry
export {
  JitterStrategy,
  calculateDelay,
  parseRetryAfter,
  SAFE_METHODS,
  IDEMPOTENT_METHODS,
  shouldRetryMethod,
} from './retry/jitter.js';
export {
  DEFAULT_RETRY_CONFIG,
  normalizeRetryConfig,
  RETRYABLE_ERROR_CODES,
  isRetryableError,
} from './retry/config.js';
export type { RetryConfig } from './retry/config.js';
export { CircuitState, CircuitBreaker, CircuitOpenError } from './retry/circuit-breaker.js';
export type { CircuitBreakerConfig } from './retry/circuit-breaker.js';

// Transport
export { DispatcherFactory, createPool, createAgent } from './transport/dispatcher.js';
export type { DispatcherOptions } from './transport/dispatcher.js';
export { MountRouter, createMountRouter } from './transport/router.js';

// Streaming
export {
  iterBytes,
  collectBytes,
  createProgressStream,
  iterText,
  collectText,
  iterLines,
  iterNDJSON,
  collectLines,
  iterSSE,
} from './streaming/index.js';
export type { ProgressStreamHandle, SSEEvent } from './streaming/index.js';

// Request building
export { processBody, hasBodyOptions, buildMultipartFormData } from './request/body.js';
export type { BodyOptions, FileUpload, ProcessedBody } from './request/body.js';
export {
  mergeParams,
  buildURLWithParams,
  parseQueryString,
  serializeParams,
} from './request/params.js';

// Interceptors
export { createLoggingInterceptor } from './interceptors/logging.js';
export type { LoggingInterceptorOptions } from './interceptors/logging.js';
export { HooksManager, createHooksManager } from './interceptors/hooks.js';
export type { RequestHook, ResponseHook, EventHooksConfig } from './interceptors/hooks.js';

// Logger
export { logger, create as createLogger } from './logger.js';
export type { Logger, LogLevel, LogEntry, LoggerOptions } from './logger.js';

// Cache
export {
  MemoryStorage,
  CacheManager,
  defaultKeyStrategy,
  createDotNotationKeyStrategy,
  createHashedKeyStrategy,
  combineKeyStrategies,
  CachingClient,
  withCache,
  withCacheSimple,
  cached,
  createCachedFunction,
  createCacheHooks,
  createCacheAwareClient,
} from './cache/index.js';
export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheStorage as CacheStorageInterface,
  CacheKeyStrategy,
  RequestCacheOptions,
  CachingClientOptions,
  CachingRequestOptions,
  CacheHooks,
  CacheMiddlewareOptions,
  WithCacheOptions,
  FetchFunction,
  SimpleFetchFunction,
} from './cache/index.js';
