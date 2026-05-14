"""Example: BYO (bring-your-own) fetch client — wrap a user-configured
``polyglot-fetch-http-client`` AsyncClient and pass it to FigmaClient.

Run:
    FIGMA_PASS=$YOUR_TOKEN python -m examples.sdk.byo_fetch_client
"""

from __future__ import annotations

import asyncio
import os
import sys

from fetch_http_client import APIKeyAuth, AsyncClient, RetryConfig

from figma_api import FigmaClient, fetch_client_from_polyglot


async def main() -> None:
    token = os.environ.get("FIGMA_PASS")
    if not token:
        raise RuntimeError("Missing env FIGMA_PASS")

    outer = AsyncClient(
        base_url="https://api.figma.com",
        auth=APIKeyAuth(token, "X-Figma-Token"),
        headers={"accept": "application/json"},
        retry=RetryConfig(max_attempts=3),
    )

    client = FigmaClient(token=token, fetch_client=fetch_client_from_polyglot(outer))
    try:
        me = await client.me.get()
        sys.stdout.write(f"Figma (BYO) → @{me.get('handle')}\n")
    finally:
        await client.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Example failed: {err}\n")
        sys.exit(1)
