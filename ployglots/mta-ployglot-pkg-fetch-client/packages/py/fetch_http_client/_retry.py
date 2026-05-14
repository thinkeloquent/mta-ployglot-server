"""Retry + circuit breaker.

`RetryConfig` drives the AsyncClient retry loop. `CircuitBreaker` gates
requests to failing upstreams, flipping between CLOSED → OPEN → HALF_OPEN
based on consecutive failures / successes.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from enum import StrEnum

from ._exceptions import CircuitOpenError

# HTTP methods considered idempotent / safe for automatic retry.
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})
IDEMPOTENT_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE", "PUT", "DELETE"})

DEFAULT_RETRY_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})


class JitterStrategy(StrEnum):
    """Retry backoff jitter strategies."""

    NONE = "none"
    FULL = "full"
    EQUAL = "equal"
    DECORRELATED = "decorrelated"


@dataclass
class RetryConfig:
    """Retry policy for a single request.

    Backoff is computed as `base * (multiplier ** attempt)`, capped at
    `max_delay`, then jittered per `jitter` strategy.
    """

    max_attempts: int = 3
    base_delay: float = 0.1
    max_delay: float = 30.0
    multiplier: float = 2.0
    jitter: JitterStrategy = JitterStrategy.FULL
    retry_on_status: frozenset[int] = DEFAULT_RETRY_STATUS
    retry_methods: frozenset[str] = IDEMPOTENT_METHODS

    def compute_delay(self, attempt: int, previous_delay: float = 0.0) -> float:
        """Delay to sleep *before* `attempt` (0-indexed)."""
        raw = min(self.base_delay * (self.multiplier**attempt), self.max_delay)
        if self.jitter is JitterStrategy.NONE:
            return raw
        if self.jitter is JitterStrategy.FULL:
            return random.uniform(0, raw)
        if self.jitter is JitterStrategy.EQUAL:
            return raw / 2 + random.uniform(0, raw / 2)
        if self.jitter is JitterStrategy.DECORRELATED:
            base = max(self.base_delay, previous_delay)
            return min(random.uniform(self.base_delay, base * 3), self.max_delay)
        return raw


# =============================================================================
# Circuit breaker
# =============================================================================


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    success_threshold: int = 2
    recovery_timeout: float = 30.0
    half_open_max_calls: int = 1


@dataclass
class CircuitBreaker:
    config: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    opened_at: float | None = None

    def allow(self) -> bool:
        """Return True if a request may proceed under current state."""
        if self.state is CircuitState.CLOSED:
            return True
        if self.state is CircuitState.OPEN:
            if self.opened_at is None:
                return False
            if time.monotonic() - self.opened_at >= self.config.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                return True
            return False
        if self.state is CircuitState.HALF_OPEN:
            return self.success_count < self.config.half_open_max_calls
        return False  # pragma: no cover — defensive: all enum states covered above

    def check(self) -> None:
        """Raise `CircuitOpenError` if the circuit is currently gated."""
        if not self.allow():
            raise CircuitOpenError(
                f"Circuit breaker is OPEN; retry in {self.config.recovery_timeout:.1f}s"
            )

    def record_success(self) -> None:
        if self.state is CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.config.success_threshold:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
                self.opened_at = None
        else:
            self.failure_count = 0

    def record_failure(self) -> None:
        self.failure_count += 1
        if self.state is CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            self.opened_at = time.monotonic()
            return
        if self.failure_count >= self.config.failure_threshold:
            self.state = CircuitState.OPEN
            self.opened_at = time.monotonic()


__all__ = [
    "DEFAULT_RETRY_STATUS",
    "IDEMPOTENT_METHODS",
    "SAFE_METHODS",
    "CircuitBreaker",
    "CircuitBreakerConfig",
    "CircuitState",
    "JitterStrategy",
    "RetryConfig",
]
