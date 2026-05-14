"""Configuration primitives: Timeout, Limits, Proxy, env discovery.

These mirror the TS package's config surface. Every field has a sensible
default so a caller can do `AsyncClient()` with zero kwargs.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

# =============================================================================
# Timeout
# =============================================================================


@dataclass(frozen=True)
class Timeout:
    """Per-phase request timeouts (seconds).

    Matches httpx.Timeout semantics: separate budgets for connect, read,
    write, and pool-wait.
    """

    connect: float | None = 5.0
    read: float | None = 30.0
    write: float | None = 30.0
    pool: float | None = 5.0

    @classmethod
    def from_any(cls, value: Any) -> Timeout:
        """Accept a number (flat), dict, or Timeout and normalise."""
        if isinstance(value, cls):
            return value
        if value is None:
            return cls()
        if isinstance(value, int | float):
            v = float(value)
            return cls(connect=v, read=v, write=v, pool=v)
        if isinstance(value, dict):
            return cls(
                connect=value.get("connect", 5.0),
                read=value.get("read", 30.0),
                write=value.get("write", 30.0),
                pool=value.get("pool", 5.0),
            )
        raise TypeError(f"Unsupported timeout value: {type(value).__name__}")

    def to_httpx(self) -> Any:
        """Return an httpx.Timeout instance."""
        import httpx

        return httpx.Timeout(
            connect=self.connect,
            read=self.read,
            write=self.write,
            pool=self.pool,
        )


DEFAULT_TIMEOUT = Timeout()
DEFAULT_LLM_TIMEOUT = Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0)


# =============================================================================
# Limits
# =============================================================================


@dataclass(frozen=True)
class Limits:
    """Connection pool limits."""

    max_connections: int | None = 100
    max_keepalive_connections: int | None = 20
    keepalive_expiry: float | None = 5.0

    def to_httpx(self) -> Any:
        import httpx

        return httpx.Limits(
            max_connections=self.max_connections,
            max_keepalive_connections=self.max_keepalive_connections,
            keepalive_expiry=self.keepalive_expiry,
        )


DEFAULT_LIMITS = Limits()


# =============================================================================
# Proxy
# =============================================================================


@dataclass
class ProxyAuth:
    """Proxy auth credentials."""

    username: str
    password: str


@dataclass
class Proxy:
    """HTTP/HTTPS forward proxy descriptor.

    Empty `Proxy()` == "look up HTTPS_PROXY / HTTP_PROXY from env". The
    examples-layer helper `build_proxy({})` uses this semantic directly —
    pass `{}` to auto-detect, pass fields to override.
    """

    url: str | None = None
    auth: ProxyAuth | None = None
    headers: dict[str, str] = field(default_factory=dict)

    def resolved_url(self) -> str | None:
        """Return the fully-resolved proxy URL (with embedded auth if any)."""
        url = self.url
        if url is None:
            return None
        if self.auth is None:
            return url
        parsed = urlparse(url)
        netloc = f"{self.auth.username}:{self.auth.password}@{parsed.hostname}"
        if parsed.port is not None:
            netloc += f":{parsed.port}"
        return parsed._replace(netloc=netloc).geturl()


def get_proxy_from_env() -> str | None:
    """Resolve a proxy URL from HTTPS_PROXY / HTTP_PROXY (lower + upper case)."""
    for key in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        v = os.environ.get(key)
        if v:
            return v
    return None


def should_bypass_proxy(host: str) -> bool:
    """True when `host` matches NO_PROXY rules.

    NO_PROXY is comma-separated: exact match, suffix match (leading dot
    optional), or '*' (disable proxy entirely).
    """
    no_proxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
    if not no_proxy:
        return False
    host_lc = host.lower()
    for raw in no_proxy.split(","):
        rule = raw.strip().lower()
        if not rule:
            continue
        if rule == "*":
            return True
        if rule.startswith("."):
            if host_lc.endswith(rule) or host_lc == rule[1:]:
                return True
        elif host_lc == rule or host_lc.endswith("." + rule):
            return True
    return False


__all__ = [
    "DEFAULT_LIMITS",
    "DEFAULT_LLM_TIMEOUT",
    "DEFAULT_TIMEOUT",
    "Limits",
    "Proxy",
    "ProxyAuth",
    "Timeout",
    "get_proxy_from_env",
    "should_bypass_proxy",
]
