// @ts-nocheck
import logger from '../logger.js';

const log = logger.create('@polyglot/fetch-http-client', 'retry/circuit-breaker.ts');

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export interface CircuitBreakerConfig {
  enabled?: boolean;
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetAfter?: number;
}

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_SUCCESS_THRESHOLD = 2;
const DEFAULT_TIMEOUT = 60_000;

export class CircuitBreaker {
  private _state: CircuitState = CircuitState.CLOSED;
  private _failureCount = 0;
  private _successCount = 0;
  private _lastFailureTime = 0;
  private readonly _enabled: boolean;
  private readonly _failureThreshold: number;
  private readonly _successThreshold: number;
  private readonly _timeout: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this._enabled = config.enabled ?? true;
    this._failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this._successThreshold = config.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    this._timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  get state(): CircuitState {
    return this._state;
  }
  get isOpen(): boolean {
    return this._state === CircuitState.OPEN;
  }
  get failureCount(): number {
    return this._failureCount;
  }

  allowRequest(): boolean {
    if (!this._enabled) return true;
    if (this._state === CircuitState.CLOSED) return true;
    if (this._state === CircuitState.OPEN) {
      if (Date.now() - this._lastFailureTime > this._timeout) {
        this._transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    if (!this._enabled) return;
    if (this._state === CircuitState.HALF_OPEN) {
      this._successCount += 1;
      if (this._successCount >= this._successThreshold) {
        this._transitionTo(CircuitState.CLOSED);
      }
      return;
    }
    if (this._state === CircuitState.CLOSED) {
      this._failureCount = 0;
    }
  }

  recordFailure(): void {
    if (!this._enabled) return;
    this._lastFailureTime = Date.now();
    if (this._state === CircuitState.CLOSED) {
      this._failureCount += 1;
      if (this._failureCount >= this._failureThreshold) {
        this._transitionTo(CircuitState.OPEN);
      }
      return;
    }
    if (this._state === CircuitState.HALF_OPEN) {
      this._transitionTo(CircuitState.OPEN);
    }
  }

  reset(): void {
    this._state = CircuitState.CLOSED;
    this._failureCount = 0;
    this._successCount = 0;
  }

  private _transitionTo(next: CircuitState): void {
    const prev = this._state;
    this._state = next;
    if (next === CircuitState.CLOSED) {
      this._failureCount = 0;
      this._successCount = 0;
    } else if (next === CircuitState.HALF_OPEN) {
      this._successCount = 0;
    }
    log.debug('circuit transition', { from: prev, to: next });
  }
}
