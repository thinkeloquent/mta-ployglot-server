"""API example: on_request / on_response hooks for request-id + timing."""

from __future__ import annotations

import asyncio
import sys
import time
import uuid

import httpx

from fetch_http_client import AsyncClient


async def main() -> None:
    request_started: dict[str, float] = {}

    async def attach_request_id(req: httpx.Request) -> None:
        req.headers["x-request-id"] = str(uuid.uuid4())
        request_started[req.headers["x-request-id"]] = time.monotonic()

    async def log_response(resp: httpx.Response) -> None:
        rid = resp.request.headers.get("x-request-id", "?")
        started = request_started.pop(rid, time.monotonic())
        sys.stdout.write(
            f"[{rid}] {resp.request.method} {resp.request.url} "
            f"→ {resp.status_code} in {int((time.monotonic() - started) * 1000)}ms\n"
        )

    async with AsyncClient(
        base_url="https://httpbin.org",
        on_request=[attach_request_id],
        on_response=[log_response],
    ) as client:
        await client.get("/get")


if __name__ == "__main__":
    asyncio.run(main())
