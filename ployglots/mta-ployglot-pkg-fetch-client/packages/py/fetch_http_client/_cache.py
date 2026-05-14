"""In-memory response cache.

`CacheConfig` declares the policy; `MemoryStorage` implements the default
storage backend; `CachingClient` wraps an `AsyncClient` and short-circuits
GET/HEAD responses on hit.
"""

from __future__ import annotations

import contextlib
import hashlib
import time
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CacheEntryMetadata:
    created_at: float
    expires_at: float
    hits: int = 0
    size_bytes: int = 0


@dataclass
class CacheEntry:
    status: int
    headers: dict[str, str]
    body: bytes
    metadata: CacheEntryMetadata

    def is_expired(self) -> bool:
        return time.time() >= self.metadata.expires_at


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    sets: int = 0
    evictions: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "sets": self.sets,
            "evictions": self.evictions,
        }


@dataclass
class CacheConfig:
    """Cache policy.

    `methods` restricts which verbs are cacheable (default: GET+HEAD).
    `ttl_seconds` is the default lifetime. `max_entries` is a simple LRU cap.
    """

    enabled: bool = True
    ttl_seconds: float = 300.0
    max_entries: int = 1000
    methods: frozenset[str] = frozenset({"GET", "HEAD"})
    include_status: frozenset[int] = frozenset({200, 203, 300, 301, 404, 410})

    def is_cacheable(self, method: str, status: int | None = None) -> bool:
        if not self.enabled:
            return False
        if method.upper() not in self.methods:
            return False
        return not (status is not None and status not in self.include_status)


# =============================================================================
# Key strategies
# =============================================================================


def default_key_strategy(method: str, url: str, headers: dict[str, str] | None = None) -> str:
    return f"{method.upper()} {url}"


def create_hashed_key_strategy(
    *, include_headers: Iterable[str] = ()
) -> Callable[[str, str, dict[str, str] | None], str]:
    include = {h.lower() for h in include_headers}

    def strategy(method: str, url: str, headers: dict[str, str] | None = None) -> str:
        parts = [method.upper(), url]
        if headers and include:
            for k in sorted(include):
                v = headers.get(k)
                if v is not None:
                    parts.append(f"{k}={v}")
        digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
        return digest

    return strategy


def combine_key_strategies(
    *strategies: Callable[[str, str, dict[str, str] | None], str],
) -> Callable[[str, str, dict[str, str] | None], str]:
    def combined(method: str, url: str, headers: dict[str, str] | None = None) -> str:
        return "|".join(s(method, url, headers) for s in strategies)

    return combined


# =============================================================================
# Storage
# =============================================================================


class CacheStorage:
    """Abstract storage interface."""

    async def get(self, key: str) -> CacheEntry | None:
        raise NotImplementedError

    async def set(self, key: str, entry: CacheEntry) -> None:
        raise NotImplementedError

    async def delete(self, key: str) -> None:
        raise NotImplementedError

    async def clear(self) -> None:
        raise NotImplementedError

    async def size(self) -> int:
        raise NotImplementedError


class MemoryStorage(CacheStorage):
    """In-process dict-based storage with simple LRU eviction."""

    def __init__(self, max_entries: int = 1000) -> None:
        self._store: dict[str, CacheEntry] = {}
        self._order: list[str] = []
        self.max_entries = max_entries
        self.stats = CacheStats()

    async def get(self, key: str) -> CacheEntry | None:
        entry = self._store.get(key)
        if entry is None:
            self.stats.misses += 1
            return None
        if entry.is_expired():
            await self.delete(key)
            self.stats.misses += 1
            return None
        # LRU bump
        with contextlib.suppress(ValueError):
            self._order.remove(key)
        self._order.append(key)
        self.stats.hits += 1
        entry.metadata = CacheEntryMetadata(
            created_at=entry.metadata.created_at,
            expires_at=entry.metadata.expires_at,
            hits=entry.metadata.hits + 1,
            size_bytes=entry.metadata.size_bytes,
        )
        return entry

    async def set(self, key: str, entry: CacheEntry) -> None:
        if key not in self._store and len(self._store) >= self.max_entries:
            oldest = self._order.pop(0)
            self._store.pop(oldest, None)
            self.stats.evictions += 1
        self._store[key] = entry
        if key in self._order:
            self._order.remove(key)
        self._order.append(key)
        self.stats.sets += 1

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)
        with contextlib.suppress(ValueError):
            self._order.remove(key)

    async def clear(self) -> None:
        self._store.clear()
        self._order.clear()

    async def size(self) -> int:
        return len(self._store)


# =============================================================================
# Cache manager
# =============================================================================


@dataclass
class RequestCacheOptions:
    """Per-call overrides for caching behaviour."""

    skip: bool = False
    force_refresh: bool = False
    ttl_seconds: float | None = None


@dataclass
class CacheManager:
    config: CacheConfig = field(default_factory=CacheConfig)
    storage: CacheStorage = field(default_factory=MemoryStorage)
    key_strategy: Callable[[str, str, dict[str, str] | None], str] = field(
        default=default_key_strategy
    )

    async def get(
        self, method: str, url: str, headers: dict[str, str] | None = None
    ) -> CacheEntry | None:
        if not self.config.is_cacheable(method):
            return None
        key = self.key_strategy(method, url, headers)
        return await self.storage.get(key)

    async def put(
        self,
        method: str,
        url: str,
        status: int,
        response_headers: dict[str, str],
        body: bytes,
        *,
        ttl: float | None = None,
        request_headers: dict[str, str] | None = None,
    ) -> None:
        if not self.config.is_cacheable(method, status=status):
            return
        key = self.key_strategy(method, url, request_headers)
        now = time.time()
        lifetime = ttl if ttl is not None else self.config.ttl_seconds
        entry = CacheEntry(
            status=status,
            headers=response_headers,
            body=body,
            metadata=CacheEntryMetadata(
                created_at=now,
                expires_at=now + lifetime,
                size_bytes=len(body),
            ),
        )
        await self.storage.set(key, entry)

    async def invalidate(
        self, method: str, url: str, headers: dict[str, str] | None = None
    ) -> None:
        key = self.key_strategy(method, url, headers)
        await self.storage.delete(key)

    async def clear(self) -> None:
        await self.storage.clear()

    def stats(self) -> CacheStats:
        if isinstance(self.storage, MemoryStorage):
            return self.storage.stats
        return CacheStats()


# =============================================================================
# High-level decorators / hooks
# =============================================================================


def cached(
    manager: CacheManager, *, ttl: float | None = None
) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    """Function decorator: cache the awaited result by positional-arg hash."""

    def wrapper(fn: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        async def inner(*args: Any, **kwargs: Any) -> Any:
            key = f"{fn.__module__}.{fn.__qualname__}:{args}:{sorted(kwargs.items())}"
            hit = await manager.storage.get(key)
            if hit is not None:
                import json

                try:
                    return json.loads(hit.body.decode("utf-8"))
                except Exception:
                    return hit.body
            result = await fn(*args, **kwargs)
            body = (
                result
                if isinstance(result, bytes)
                else __import__("json").dumps(result, default=str).encode("utf-8")
            )
            now = time.time()
            lifetime = ttl if ttl is not None else manager.config.ttl_seconds
            await manager.storage.set(
                key,
                CacheEntry(
                    status=200,
                    headers={},
                    body=body,
                    metadata=CacheEntryMetadata(
                        created_at=now,
                        expires_at=now + lifetime,
                        size_bytes=len(body),
                    ),
                ),
            )
            return result

        return inner

    return wrapper


__all__ = [
    "CacheConfig",
    "CacheEntry",
    "CacheEntryMetadata",
    "CacheManager",
    "CacheStats",
    "CacheStorage",
    "MemoryStorage",
    "RequestCacheOptions",
    "cached",
    "combine_key_strategies",
    "create_hashed_key_strategy",
    "default_key_strategy",
]
