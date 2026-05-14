"""Tests for RetryConfig + CircuitBreaker."""

from __future__ import annotations

import time

import pytest

from fetch_http_client import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitOpenError,
    CircuitState,
    JitterStrategy,
    RetryConfig,
)


class TestRetryConfig:
    def test_no_jitter_deterministic(self) -> None:
        r = RetryConfig(base_delay=1.0, multiplier=2.0, jitter=JitterStrategy.NONE)
        assert r.compute_delay(0) == 1.0
        assert r.compute_delay(1) == 2.0
        assert r.compute_delay(2) == 4.0

    def test_max_delay_caps(self) -> None:
        r = RetryConfig(base_delay=1.0, multiplier=10.0, max_delay=5.0, jitter=JitterStrategy.NONE)
        assert r.compute_delay(5) == 5.0

    def test_full_jitter_bounded(self) -> None:
        r = RetryConfig(base_delay=1.0, multiplier=2.0, jitter=JitterStrategy.FULL)
        for i in range(20):
            delay = r.compute_delay(2)
            assert 0 <= delay <= 4.0

    def test_equal_jitter_bounded(self) -> None:
        r = RetryConfig(base_delay=1.0, multiplier=2.0, jitter=JitterStrategy.EQUAL)
        for i in range(20):
            delay = r.compute_delay(2)
            assert 2.0 <= delay <= 4.0

    def test_decorrelated_jitter(self) -> None:
        r = RetryConfig(base_delay=0.1, max_delay=10.0, jitter=JitterStrategy.DECORRELATED)
        delay = r.compute_delay(0, previous_delay=1.0)
        assert 0.1 <= delay <= 3.0


class TestCircuitBreaker:
    def test_starts_closed(self) -> None:
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED
        assert cb.allow()

    def test_opens_after_threshold(self) -> None:
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=3))
        for _ in range(3):
            cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert not cb.allow()

    def test_check_raises_when_open(self) -> None:
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=1))
        cb.record_failure()
        with pytest.raises(CircuitOpenError):
            cb.check()

    def test_recovery_after_timeout(self) -> None:
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=1, recovery_timeout=0.05))
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        time.sleep(0.06)
        # allow() flips to HALF_OPEN after timeout
        assert cb.allow()
        assert cb.state == CircuitState.HALF_OPEN

    def test_closes_after_successes_in_half_open(self) -> None:
        cb = CircuitBreaker(
            config=CircuitBreakerConfig(
                failure_threshold=1, recovery_timeout=0.01, success_threshold=2
            )
        )
        cb.record_failure()
        time.sleep(0.02)
        cb.allow()  # → HALF_OPEN
        cb.record_success()
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_reopens_on_failure_in_half_open(self) -> None:
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=1, recovery_timeout=0.01))
        cb.record_failure()
        time.sleep(0.02)
        cb.allow()  # → HALF_OPEN
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_allow_open_no_opened_at_denies(self) -> None:
        # Defensive path: breaker forced to OPEN without an opened_at timestamp.
        cb = CircuitBreaker()
        cb.state = CircuitState.OPEN
        cb.opened_at = None
        assert not cb.allow()

    def test_allow_open_within_window_denies(self) -> None:
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=1, recovery_timeout=10.0))
        cb.record_failure()
        # Still inside the recovery window → stays OPEN.
        assert not cb.allow()
        assert cb.state == CircuitState.OPEN

    def test_allow_half_open_saturates(self) -> None:
        cb = CircuitBreaker(
            config=CircuitBreakerConfig(
                failure_threshold=1, recovery_timeout=0.01, half_open_max_calls=1
            )
        )
        cb.record_failure()
        time.sleep(0.02)
        assert cb.allow()  # → HALF_OPEN, success_count=0
        # Consume the probe slot.
        cb.success_count = cb.config.half_open_max_calls
        assert not cb.allow()  # saturated

    def test_closed_success_resets_failure_count(self) -> None:
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=3))
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2
        cb.record_success()  # not HALF_OPEN → else branch
        assert cb.failure_count == 0
        assert cb.state == CircuitState.CLOSED

    def test_half_open_success_under_threshold_keeps_state(self) -> None:
        cb = CircuitBreaker(
            config=CircuitBreakerConfig(
                failure_threshold=1, recovery_timeout=0.01, success_threshold=3
            )
        )
        cb.record_failure()
        time.sleep(0.02)
        cb.allow()  # → HALF_OPEN
        cb.record_success()
        # One success, threshold is 3 → stay HALF_OPEN.
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.success_count == 1


class TestJitterFallback:
    def test_unknown_jitter_returns_raw(self) -> None:
        # Defensive: if a future jitter variant shows up, compute_delay
        # falls back to the raw (unjittered) calculation.
        r = RetryConfig(base_delay=1.0, multiplier=2.0, jitter=JitterStrategy.NONE)
        # Bypass enum safety to exercise the fallthrough branch.
        r.jitter = "mystery"  # type: ignore[assignment]
        assert r.compute_delay(2) == 4.0
