// @ts-nocheck
import { JitterStrategy } from './jitter.js';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryBackoff: number;
  maxRetryDelay: number;
  jitter: JitterStrategy;
  retryOnStatus: number[];
  retryOnException: boolean;
  respectRetryAfter: boolean;
  retryMethods?: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoff: 2,
  maxRetryDelay: 30000,
  jitter: JitterStrategy.FULL,
  retryOnStatus: [429, 502, 503, 504],
  retryOnException: true,
  respectRetryAfter: true,
};

export function normalizeRetryConfig(
  config?: Partial<RetryConfig> | boolean | null,
): RetryConfig | null {
  if (config === null || config === undefined || config === false) return null;
  if (config === true) return { ...DEFAULT_RETRY_CONFIG };
  return { ...DEFAULT_RETRY_CONFIG, ...config };
}

export const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code && RETRYABLE_ERROR_CODES.has(code)) return true;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  if (causeCode && RETRYABLE_ERROR_CODES.has(causeCode)) return true;
  return false;
}
