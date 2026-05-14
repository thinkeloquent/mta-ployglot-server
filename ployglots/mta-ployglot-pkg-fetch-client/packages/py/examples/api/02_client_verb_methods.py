"""API example: verb methods with query params, JSON body, typed json()."""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import AsyncClient


async def main() -> None:
    async with AsyncClient(base_url="https://httpbin.org") as client:
        get_resp = await client.get("/get", params={"q": "fetch-http-client"})
        get_resp.raise_for_status()
        sys.stdout.write(f"GET args={get_resp.json()['args']}\n")

        post_resp = await client.post("/post", json={"name": "polyglot-fetch-http-client"})
        post_resp.raise_for_status()
        sys.stdout.write(f"POST body={post_resp.json()['json']}\n")


if __name__ == "__main__":
    asyncio.run(main())
