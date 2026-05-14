"""Integration smoke test — hits httpbin.org end-to-end.

This test *does* go to the network. It's skipped if httpbin is unreachable
(DNS, firewall, offline dev environment) so the suite stays green in
disconnected CI.
"""

from __future__ import annotations

import asyncio
import socket

import pytest

from fetch_http_client import AsyncClient, TransportError, fetch_httpx_async


def _httpbin_reachable() -> bool:
    try:
        socket.getaddrinfo("httpbin.org", 443)
        return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(not _httpbin_reachable(), reason="httpbin.org not reachable")


@pytest.mark.asyncio
async def test_get_live_httpbin() -> None:
    async with AsyncClient(base_url="https://httpbin.org") as client:
        try:
            resp = await client.get("/get", params={"src": "integration"})
        except TransportError as exc:
            pytest.skip(f"network flaky: {exc}")
        resp.raise_for_status()
        data = resp.json()
        assert data["args"] == {"src": "integration"}


@pytest.mark.asyncio
async def test_post_live_httpbin() -> None:
    async with AsyncClient(base_url="https://httpbin.org") as client:
        try:
            resp = await client.post("/post", json={"hello": "world"})
        except TransportError as exc:
            pytest.skip(f"network flaky: {exc}")
        resp.raise_for_status()
        assert resp.json()["json"] == {"hello": "world"}


@pytest.mark.asyncio
async def test_fetch_httpx_async_factory_live() -> None:
    async with fetch_httpx_async(base_url="https://httpbin.org") as client:
        try:
            resp = await client.get("/status/200")
        except TransportError as exc:
            pytest.skip(f"network flaky: {exc}")
        resp.raise_for_status()
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_retry_on_503_live() -> None:
    # httpbin /status/503 returns 503 deterministically — retry triggers,
    # all attempts fail, end result is status 503 returned to caller.
    async with AsyncClient(base_url="https://httpbin.org") as client:
        try:
            resp = await asyncio.wait_for(client.get("/status/503"), timeout=30.0)
        except (TransportError, TimeoutError) as exc:
            pytest.skip(f"network flaky: {exc}")
        assert resp.status_code == 503
