"""API example: tuned AsyncClient defaults.

Shows how to construct an `AsyncClient` with:
  - custom Timeout
  - BearerAuth
  - RetryConfig with full jitter

Run:
    python -m examples.api.01_create_async_client
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import (
    AsyncClient,
    BearerAuth,
    JitterStrategy,
    RetryConfig,
    Timeout,
)


async def main() -> None:
    async with AsyncClient(
        base_url="https://httpbin.org",
        auth=BearerAuth("dummy-token-never-used"),
        timeout=Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0),
        retry=RetryConfig(
            max_attempts=3,
            base_delay=0.25,
            max_delay=5.0,
            jitter=JitterStrategy.FULL,
        ),
    ) as client:
        resp = await client.get("/anything")
        resp.raise_for_status()
        sys.stdout.write(f"status={resp.status_code}\n")


if __name__ == "__main__":
    asyncio.run(main())
