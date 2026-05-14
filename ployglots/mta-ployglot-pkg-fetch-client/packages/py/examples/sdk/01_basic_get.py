"""SDK example: basic GET against httpbin.

Demonstrates the `fetch_httpx_async` factory — LLM-tuned defaults
(120 s read budget, follow redirects on, HTTP/1.1 only), zero auth.

Run:
    python -m examples.sdk.01_basic_get
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import fetch_httpx_async


async def main() -> None:
    async with fetch_httpx_async(base_url="https://httpbin.org") as client:
        resp = await client.get("/get", params={"hello": "world"})
        resp.raise_for_status()
        body = resp.json()
        sys.stdout.write(f"args={body['args']}\n")


if __name__ == "__main__":
    asyncio.run(main())
