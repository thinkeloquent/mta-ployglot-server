// @ts-nocheck
import { Headers } from '../models/headers.js';

export enum JitterStrategy {
  NONE = 'none',
  FULL = 'full',
  EQUAL = 'equal',
  DECORRELATED = 'decorrelated',
}

export function calculateDelay(
  attempt: number,
  baseDelay: number,
  backoff: number,
  maxDelay: number,
  jitter: JitterStrategy = JitterStrategy.FULL,
  lastDelay?: number,
): number {
  const exponential = Math.min(baseDelay * Math.pow(backoff, attempt), maxDelay);
  switch (jitter) {
    case JitterStrategy.NONE:
      return exponential;
    case JitterStrategy.FULL:
      return Math.random() * exponential;
    case JitterStrategy.EQUAL:
      return exponential / 2 + Math.random() * (exponential / 2);
    case JitterStrategy.DECORRELATED: {
      const prev = lastDelay ?? baseDelay;
      return Math.min(maxDelay, baseDelay + Math.random() * (prev * 3 - baseDelay));
    }
  }
}

export function parseRetryAfter(value: string | undefined | null): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) return asNumber * 1000;
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
export const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE', 'PUT', 'DELETE']);

function headerValue(h: unknown, name: string): string | null {
  if (!h) return null;
  if (h instanceof Headers) return h.get(name) ?? null;
  if (typeof (h as { get?: (n: string) => string | null }).get === 'function') {
    return (h as { get(n: string): string | null }).get(name);
  }
  const rec = h as Record<string, string | string[]>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return null;
  const v = rec[key];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export function shouldRetryMethod(
  method: string,
  headers?: Headers | Record<string, string | string[]>,
  allowedMethods?: string[] | Set<string>,
): boolean {
  const upper = method.toUpperCase();
  if (IDEMPOTENT_METHODS.has(upper)) return true;
  if (allowedMethods) {
    const allowed = allowedMethods instanceof Set ? allowedMethods : new Set(allowedMethods);
    if (allowed.has(upper)) return true;
  }
  if (headers) {
    const idemKey =
      headerValue(headers, 'Idempotency-Key') ?? headerValue(headers, 'X-Idempotency-Key');
    if (idemKey) return true;
  }
  return false;
}
