"""Tests for CachingClient — verifies hit/miss semantics over a mock transport."""

from __future__ import annotations

import httpx
import pytest

from fetch_http_client import (
    AsyncClient,
    CacheConfig,
    CachingClient,
    JitterStrategy,
    RetryConfig,
)


async def _make(status: int = 200) -> tuple[AsyncClient, dict]:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(status, json={"seq": calls["n"]})

    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    return client, calls


@pytest.mark.asyncio
async def test_second_get_is_cache_hit() -> None:
    client, calls = await _make()
    try:
        cc = CachingClient(client, config=CacheConfig(ttl_seconds=60))
        r1 = await cc.get("/ping")
        r2 = await cc.get("/ping")
        assert r1.json()["seq"] == 1
        assert r2.json()["seq"] == 1  # same payload — served from cache
        assert calls["n"] == 1
        stats = cc.cache.stats().as_dict()
        assert stats["hits"] == 1
        assert stats["sets"] == 1
    finally:
        await cc.aclose()


@pytest.mark.asyncio
async def test_post_not_cached() -> None:
    client, calls = await _make()
    try:
        cc = CachingClient(client)
        await cc.post("/items", json={"a": 1})
        await cc.post("/items", json={"a": 1})
        assert calls["n"] == 2
    finally:
        await cc.aclose()


@pytest.mark.asyncio
async def test_500_not_cached() -> None:
    client, calls = await _make(status=500)
    try:
        cc = CachingClient(client)
        await cc.get("/broken")
        await cc.get("/broken")
        assert calls["n"] == 2
    finally:
        await cc.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize("verb", ["get", "head", "post", "put", "patch", "delete"])
async def test_caching_client_dispatches_every_verb(verb: str) -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        return httpx.Response(200, json={})

    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    async with CachingClient(client) as cc:
        await getattr(cc, verb)("/x")
    assert captured["method"] == verb.upper()


@pytest.mark.asyncio
async def test_caching_client_as_context_manager_closes_inner() -> None:
    client, _ = await _make()
    cc = CachingClient(client)
    async with cc:
        pass
    # Inner AsyncClient was closed by aclose().
    assert client._closed


@pytest.mark.asyncio
async def test_caching_client_explicit_config_preserves_max_entries() -> None:
    from fetch_http_client import CacheConfig, MemoryStorage

    client, _ = await _make()
    try:
        cc = CachingClient(client, config=CacheConfig(max_entries=3))
        assert isinstance(cc.cache.storage, MemoryStorage)
        assert cc.cache.storage.max_entries == 3
    finally:
        await cc.aclose()
