"""Lazy registry of fetch_http_client.AsyncClient instances, one per provider."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from fetch_http_client import AsyncClient

log = logging.getLogger("fastapi_server.fetch_clients")

ProviderFactory = Callable[[], Awaitable[AsyncClient]]


class FetchClientRegistry:
    def __init__(self, factories: dict[str, ProviderFactory]):
        self._factories = dict(factories)
        self._constructed: dict[str, AsyncClient] = {}
        self._locks: dict[str, asyncio.Lock] = {p: asyncio.Lock() for p in factories}

    @property
    def providers(self) -> tuple[str, ...]:
        return tuple(self._factories.keys())

    async def get(self, name: str) -> AsyncClient:
        if name not in self._factories:
            raise KeyError(
                f"unknown fetchClient: {name}; valid: {'|'.join(self._factories)}"
            )
        if name in self._constructed:
            return self._constructed[name]
        async with self._locks[name]:
            if name in self._constructed:
                return self._constructed[name]
            client = await self._factories[name]()
            self._constructed[name] = client
            return client

    async def aclose(self) -> None:
        for name, client in list(self._constructed.items()):
            try:
                await client.aclose()
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "fetch-client close failed: provider=%s err=%s", name, exc
                )
        self._constructed.clear()
