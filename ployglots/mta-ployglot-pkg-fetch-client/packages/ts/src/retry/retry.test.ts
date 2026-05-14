// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  JitterStrategy,
  calculateDelay,
  parseRetryAfter,
  shouldRetryMethod,
  SAFE_METHODS,
  IDEMPOTENT_METHODS,
} from './jitter.js';
import { normalizeRetryConfig, isRetryableError, RETRYABLE_ERROR_CODES } from './config.js';
import { CircuitBreaker, CircuitState } from './circuit-breaker.js';
import { Headers } from '../models/headers.js';

describe('jitter & calculateDelay', () => {
  it('NONE = exponential, capped', () => {
    expect(calculateDelay(0, 100, 2, 10000, JitterStrategy.NONE)).toBe(100);
    expect(calculateDelay(2, 100, 2, 10000, JitterStrategy.NONE)).toBe(400);
    expect(calculateDelay(100, 100, 2, 5000, JitterStrategy.NONE)).toBe(5000);
  });
  it('FULL is in [0, exponential]', () => {
    const d = calculateDelay(1, 100, 2, 10000, JitterStrategy.FULL);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(200);
  });
  it('EQUAL is in [exp/2, exp]', () => {
    const d = calculateDelay(1, 100, 2, 10000, JitterStrategy.EQUAL);
    expect(d).toBeGreaterThanOrEqual(100);
    expect(d).toBeLessThanOrEqual(200);
  });
  it('DECORRELATED uses lastDelay', () => {
    const d = calculateDelay(1, 100, 2, 10000, JitterStrategy.DECORRELATED, 500);
    expect(d).toBeGreaterThanOrEqual(100);
  });
});

describe('parseRetryAfter', () => {
  it('numeric seconds → ms', () => {
    expect(parseRetryAfter('30')).toBe(30000);
  });
  it('future date returns positive ms', () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    expect(parseRetryAfter(future)).toBeGreaterThan(0);
  });
  it('invalid returns null', () => {
    expect(parseRetryAfter('not-a-time')).toBeNull();
  });
  it('null/undefined → null', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
  });
});

describe('shouldRetryMethod', () => {
  it('idempotent methods', () => {
    expect(shouldRetryMethod('GET')).toBe(true);
    expect(shouldRetryMethod('PUT')).toBe(true);
    expect(shouldRetryMethod('POST')).toBe(false);
  });
  it('Idempotency-Key header overrides', () => {
    expect(shouldRetryMethod('POST', new Headers({ 'Idempotency-Key': 'abc' }))).toBe(true);
    expect(shouldRetryMethod('POST', { 'x-idempotency-key': 'abc' })).toBe(true);
  });
  it('allowedMethods extends', () => {
    expect(shouldRetryMethod('POST', undefined, ['POST'])).toBe(true);
  });
  it('safe/idempotent set sizes', () => {
    expect(SAFE_METHODS.size).toBe(4);
    expect(IDEMPOTENT_METHODS.size).toBe(6);
  });
});

describe('RetryConfig', () => {
  it('normalize: undefined → null', () => {
    expect(normalizeRetryConfig(undefined)).toBeNull();
    expect(normalizeRetryConfig(false)).toBeNull();
  });
  it('normalize: true → defaults', () => {
    const c = normalizeRetryConfig(true);
    expect(c).not.toBeNull();
    expect(c!.maxRetries).toBe(3);
  });
  it('normalize: partial merges', () => {
    const c = normalizeRetryConfig({ maxRetries: 10 });
    expect(c!.maxRetries).toBe(10);
    expect(c!.retryBackoff).toBe(2);
  });
  it('isRetryableError on POSIX code', () => {
    expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isRetryableError(new Error('x'))).toBe(false);
  });
  it('isRetryableError on cause.code', () => {
    expect(isRetryableError({ cause: { code: 'ETIMEDOUT' } })).toBe(true);
  });
  it('RETRYABLE_ERROR_CODES has 12 entries', () => {
    expect(RETRYABLE_ERROR_CODES.size).toBe(12);
  });
});

describe('CircuitBreaker', () => {
  it('starts CLOSED', () => {
    expect(new CircuitBreaker().state).toBe(CircuitState.CLOSED);
  });
  it('opens after failureThreshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, timeout: 10_000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
    expect(cb.allowRequest()).toBe(false);
  });
  it('disabled allows all', () => {
    const cb = new CircuitBreaker({ enabled: false });
    for (let i = 0; i < 100; i++) cb.recordFailure();
    expect(cb.allowRequest()).toBe(true);
  });
  it('reset returns to CLOSED', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
    cb.reset();
    expect(cb.state).toBe(CircuitState.CLOSED);
    expect(cb.failureCount).toBe(0);
  });
  it('HALF_OPEN → CLOSED after successThreshold successes', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 1,
    });
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
    // simulate timeout passed (allowRequest moves to HALF_OPEN)
    setTimeout(() => {}, 0);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(cb.allowRequest()).toBe(true);
        expect(cb.state).toBe(CircuitState.HALF_OPEN);
        cb.recordSuccess();
        cb.recordSuccess();
        expect(cb.state).toBe(CircuitState.CLOSED);
        resolve();
      }, 10),
    );
  });
});
