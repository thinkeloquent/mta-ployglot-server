"""Tests for cache layer."""

from __future__ import annotations

import time

import pytest

from fetch_http_client import (
    CacheConfig,
    CacheEntry,
    CacheEntryMetadata,
    CacheManager,
    CacheStorage,
    MemoryStorage,
    combine_key_strategies,
    create_hashed_key_strategy,
    default_key_strategy,
)


class TestCacheConfig:
    def test_cacheable_default_methods(self) -> None:
        cfg = CacheConfig()
        assert cfg.is_cacheable("GET")
        assert cfg.is_cacheable("HEAD")
        assert not cfg.is_cacheable("POST")

    def test_disabled(self) -> None:
        cfg = CacheConfig(enabled=False)
        assert not cfg.is_cacheable("GET")

    def test_status_filter(self) -> None:
        cfg = CacheConfig()
        assert cfg.is_cacheable("GET", status=200)
        assert not cfg.is_cacheable("GET", status=500)


class TestKeyStrategies:
    def test_default(self) -> None:
        assert default_key_strategy("get", "https://x") == "GET https://x"

    def test_hashed_without_headers(self) -> None:
        s = create_hashed_key_strategy()
        k1 = s("GET", "https://x")
        k2 = s("GET", "https://x")
        assert k1 == k2
        assert len(k1) == 64

    def test_hashed_with_headers(self) -> None:
        s = create_hashed_key_strategy(include_headers=["accept"])
        k1 = s("GET", "https://x", {"accept": "application/json"})
        k2 = s("GET", "https://x", {"accept": "text/plain"})
        assert k1 != k2

    def test_combined(self) -> None:
        s = combine_key_strategies(default_key_strategy, default_key_strategy)
        assert s("GET", "https://x") == "GET https://x|GET https://x"


class TestMemoryStorage:
    async def test_set_and_get(self) -> None:
        s = MemoryStorage()
        entry = CacheEntry(
            status=200,
            headers={},
            body=b"hello",
            metadata=CacheEntryMetadata(
                created_at=time.time(), expires_at=time.time() + 60, size_bytes=5
            ),
        )
        await s.set("k", entry)
        got = await s.get("k")
        assert got is not None
        assert got.body == b"hello"
        assert s.stats.sets == 1
        assert s.stats.hits == 1

    async def test_miss(self) -> None:
        s = MemoryStorage()
        assert await s.get("missing") is None
        assert s.stats.misses == 1

    async def test_expiry(self) -> None:
        s = MemoryStorage()
        entry = CacheEntry(
            status=200,
            headers={},
            body=b"x",
            metadata=CacheEntryMetadata(
                created_at=time.time(), expires_at=time.time() - 1, size_bytes=1
            ),
        )
        await s.set("k", entry)
        assert await s.get("k") is None

    async def test_eviction(self) -> None:
        s = MemoryStorage(max_entries=2)
        for i in range(3):
            await s.set(
                f"k{i}",
                CacheEntry(
                    status=200,
                    headers={},
                    body=b"x",
                    metadata=CacheEntryMetadata(
                        created_at=time.time(),
                        expires_at=time.time() + 60,
                        size_bytes=1,
                    ),
                ),
            )
        assert await s.size() == 2
        assert s.stats.evictions == 1


class TestCacheManager:
    @pytest.mark.asyncio
    async def test_put_and_get_roundtrip(self) -> None:
        cm = CacheManager()
        await cm.put("GET", "https://x", status=200, response_headers={"a": "b"}, body=b"ok")
        got = await cm.get("GET", "https://x")
        assert got is not None
        assert got.body == b"ok"

    @pytest.mark.asyncio
    async def test_post_not_cached(self) -> None:
        cm = CacheManager()
        await cm.put("POST", "https://x", status=200, response_headers={}, body=b"ok")
        assert await cm.get("POST", "https://x") is None

    @pytest.mark.asyncio
    async def test_500_not_cached(self) -> None:
        cm = CacheManager()
        await cm.put("GET", "https://x", status=500, response_headers={}, body=b"err")
        assert await cm.get("GET", "https://x") is None

    @pytest.mark.asyncio
    async def test_put_respects_per_call_ttl(self) -> None:
        cm = CacheManager(config=CacheConfig(ttl_seconds=300))
        await cm.put("GET", "https://x", status=200, response_headers={}, body=b"short", ttl=0.05)
        assert await cm.get("GET", "https://x") is not None
        import asyncio as _asyncio

        await _asyncio.sleep(0.07)
        assert await cm.get("GET", "https://x") is None

    @pytest.mark.asyncio
    async def test_invalidate(self) -> None:
        cm = CacheManager()
        await cm.put("GET", "https://x", status=200, response_headers={}, body=b"v")
        assert await cm.get("GET", "https://x") is not None
        await cm.invalidate("GET", "https://x")
        assert await cm.get("GET", "https://x") is None

    @pytest.mark.asyncio
    async def test_manager_clear(self) -> None:
        cm = CacheManager()
        await cm.put("GET", "https://a", status=200, response_headers={}, body=b"1")
        await cm.put("GET", "https://b", status=200, response_headers={}, body=b"2")
        await cm.clear()
        assert await cm.get("GET", "https://a") is None
        assert await cm.get("GET", "https://b") is None

    def test_stats_default_when_storage_not_memory(self) -> None:
        class DummyStorage(CacheStorage):
            async def get(self, key: str) -> CacheEntry | None:
                return None

            async def set(self, key: str, entry: CacheEntry) -> None: ...

            async def delete(self, key: str) -> None: ...

            async def clear(self) -> None: ...

            async def size(self) -> int:
                return 0

        cm = CacheManager(storage=DummyStorage())
        stats = cm.stats()
        assert stats.hits == 0
        assert stats.misses == 0

    @pytest.mark.asyncio
    async def test_get_on_uncacheable_method_returns_none(self) -> None:
        cm = CacheManager()
        # POST is not cacheable by default — manager.get short-circuits before
        # hitting storage.
        assert await cm.get("POST", "https://x") is None


class TestAbstractCacheStorage:
    """Each abstract method raises NotImplementedError (positive contract check)."""

    @pytest.mark.asyncio
    async def test_get_raises(self) -> None:
        s = CacheStorage()
        with pytest.raises(NotImplementedError):
            await s.get("k")

    @pytest.mark.asyncio
    async def test_set_raises(self) -> None:
        s = CacheStorage()
        entry = CacheEntry(
            status=200,
            headers={},
            body=b"",
            metadata=CacheEntryMetadata(created_at=0.0, expires_at=0.0),
        )
        with pytest.raises(NotImplementedError):
            await s.set("k", entry)

    @pytest.mark.asyncio
    async def test_delete_raises(self) -> None:
        s = CacheStorage()
        with pytest.raises(NotImplementedError):
            await s.delete("k")

    @pytest.mark.asyncio
    async def test_clear_raises(self) -> None:
        s = CacheStorage()
        with pytest.raises(NotImplementedError):
            await s.clear()

    @pytest.mark.asyncio
    async def test_size_raises(self) -> None:
        s = CacheStorage()
        with pytest.raises(NotImplementedError):
            await s.size()


class TestMemoryStorageLifecycle:
    """Extra positive/negative coverage for MemoryStorage corners."""

    @pytest.mark.asyncio
    async def test_set_overwrite_bumps_order(self) -> None:
        s = MemoryStorage(max_entries=5)
        entry = CacheEntry(
            status=200,
            headers={},
            body=b"v",
            metadata=CacheEntryMetadata(
                created_at=time.time(), expires_at=time.time() + 60, size_bytes=1
            ),
        )
        # First set places the key at the tail.
        await s.set("k", entry)
        # Second set of the same key must remove + re-append (order line).
        await s.set("k", entry)
        assert await s.size() == 1
        assert s.stats.sets == 2

    @pytest.mark.asyncio
    async def test_clear_empties_store(self) -> None:
        s = MemoryStorage()
        entry = CacheEntry(
            status=200,
            headers={},
            body=b"v",
            metadata=CacheEntryMetadata(
                created_at=time.time(), expires_at=time.time() + 60, size_bytes=1
            ),
        )
        await s.set("a", entry)
        await s.set("b", entry)
        await s.clear()
        assert await s.size() == 0
        assert await s.get("a") is None


class TestCachedDecorator:
    @pytest.mark.asyncio
    async def test_first_call_runs_second_call_hits_cache(self) -> None:
        cm = CacheManager()
        from fetch_http_client import cached

        calls = {"n": 0}

        @cached(cm, ttl=60)
        async def expensive(x: int) -> dict:
            calls["n"] += 1
            return {"doubled": x * 2}

        first = await expensive(5)
        second = await expensive(5)
        assert first == {"doubled": 10}
        assert second == {"doubled": 10}
        assert calls["n"] == 1  # second came from cache

    @pytest.mark.asyncio
    async def test_different_args_miss_cache(self) -> None:
        cm = CacheManager()
        from fetch_http_client import cached

        calls = {"n": 0}

        @cached(cm)
        async def work(x: int) -> int:
            calls["n"] += 1
            return x + 1

        await work(1)
        await work(2)
        assert calls["n"] == 2

    @pytest.mark.asyncio
    async def test_bytes_body_round_trip(self) -> None:
        # When the function returns bytes, the decorator stores/returns them
        # as-is (no JSON encoding).
        cm = CacheManager()
        from fetch_http_client import cached

        @cached(cm)
        async def raw() -> bytes:
            return b"binary-payload"

        first = await raw()
        second = await raw()
        assert first == b"binary-payload"
        assert second == b"binary-payload"

    @pytest.mark.asyncio
    async def test_non_json_encoded_body_returns_raw_bytes(self) -> None:
        # Force a cache entry whose body is invalid JSON; the decorator must
        # fall back to returning the raw bytes rather than raising.
        cm = CacheManager()
        from fetch_http_client import cached

        @cached(cm)
        async def fn(x: int) -> dict:
            return {"k": x}

        # Run once to populate the cache at whatever key the decorator chose.
        await fn(1)
        # Now overwrite the stored entry's body with non-JSON bytes.
        store = cm.storage._store  # type: ignore[attr-defined]
        (stored_key, stored_entry) = next(iter(store.items()))
        store[stored_key] = CacheEntry(
            status=stored_entry.status,
            headers=stored_entry.headers,
            body=b"not json at all",
            metadata=stored_entry.metadata,
        )
        # Second call finds the corrupted body, fails JSON decode, and
        # returns the raw bytes.
        hit = await fn(1)
        assert hit == b"not json at all"

    @pytest.mark.asyncio
    async def test_default_ttl_used_when_not_specified(self) -> None:
        cm = CacheManager(config=CacheConfig(ttl_seconds=60))
        from fetch_http_client import cached

        @cached(cm)
        async def fn() -> dict:
            return {"a": 1}

        await fn()
        # Entry exists — size > 0.
        assert await cm.storage.size() == 1
