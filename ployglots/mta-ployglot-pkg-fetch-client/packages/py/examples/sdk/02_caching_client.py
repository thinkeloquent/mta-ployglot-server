"""SDK example: CachingClient.

The second GET for the same URL is served from memory. `cache.stats()`
reports hits / misses / sets.

Run:
    python -m examples.sdk.02_caching_client
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import AsyncClient, CacheConfig, CachingClient


async def main() -> None:
    async with AsyncClient(base_url="https://httpbin.org") as inner:
        async with CachingClient(inner, config=CacheConfig(ttl_seconds=60)) as client:
            await client.get("/uuid")  # miss → set
            await client.get("/uuid")  # hit
            stats = client.cache.stats().as_dict()
            sys.stdout.write(f"cache stats: {stats}\n")


if __name__ == "__main__":
    asyncio.run(main())
