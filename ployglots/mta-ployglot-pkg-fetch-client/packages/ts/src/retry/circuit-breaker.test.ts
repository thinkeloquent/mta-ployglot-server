// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, CircuitOpenError } from './circuit-breaker.js';

describe('CircuitBreaker defaults', () => {
  it('starts CLOSED with zero counters', () => {
    const cb = new CircuitBreaker();
    expect(cb.state).toBe(CircuitState.CLOSED);
    expect(cb.failureCount).toBe(0);
    expect(cb.isOpen).toBe(false);
  });

  it('default thresholds: 5 failures opens', () => {
    const cb = new CircuitBreaker();
    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
    expect(cb.allowRequest()).toBe(false);
  });
});

describe('CircuitBreaker config overrides', () => {
  it('failureThreshold respected', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, timeout: 10_000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.CLOSED);
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
  });

  it('disabled always permits', () => {
    const cb = new CircuitBreaker({ enabled: false, failureThreshold: 1 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.allowRequest()).toBe(true);
  });
});

describe('CircuitBreaker state transitions (deterministic clock)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('OPEN → HALF_OPEN after timeout elapses', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, timeout: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);

    vi.setSystemTime(2000);
    expect(cb.allowRequest()).toBe(true);
    expect(cb.state).toBe(CircuitState.HALF_OPEN);
  });

  it('HALF_OPEN → CLOSED after successThreshold consecutive successes', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 2, timeout: 100 });
    cb.recordFailure();
    vi.setSystemTime(500);
    cb.allowRequest();
    expect(cb.state).toBe(CircuitState.HALF_OPEN);
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.state).toBe(CircuitState.CLOSED);
  });

  it('HALF_OPEN re-opens on a single failure', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 100 });
    cb.recordFailure();
    vi.setSystemTime(500);
    cb.allowRequest();
    expect(cb.state).toBe(CircuitState.HALF_OPEN);
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
  });

  it('OPEN before timeout still rejects', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 5000 });
    cb.recordFailure();
    vi.setSystemTime(1000);
    expect(cb.allowRequest()).toBe(false);
    expect(cb.state).toBe(CircuitState.OPEN);
  });
});

describe('CircuitBreaker reset', () => {
  it('clears state and counters', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.state).toBe(CircuitState.OPEN);
    cb.reset();
    expect(cb.state).toBe(CircuitState.CLOSED);
    expect(cb.failureCount).toBe(0);
  });
});

describe('CircuitOpenError', () => {
  it('is an Error with the right .name', () => {
    const e = new CircuitOpenError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('CircuitOpenError');
  });
  it('default message', () => {
    expect(new CircuitOpenError().message).toMatch(/circuit/i);
  });
});
