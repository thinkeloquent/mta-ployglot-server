"""Example: fetch through an outbound proxy.

Three proxy-configuration modes, all using the same ``proxy = {}``
contract:

    1. Auto-detect         `proxy={}` reads HTTPS_PROXY / HTTP_PROXY.
    2. Explicit host only  `proxy={"host": "http://p:3128"}`.
    3. Full override       `proxy={"host": h, "user": u, "pass": p}`.

Env:
    FIGMA_PASS       required
    HTTPS_PROXY      optional (consumed by mode 1)
    HTTP_PROXY_USER  optional (mode 1 / 3)
    HTTP_PROXY_PASS  optional (mode 1 / 3)

Run:
    FIGMA_PASS=$YOUR_TOKEN python -m examples.sdk.with_proxy auto
"""

from __future__ import annotations

import asyncio
import os
import sys

from figma_api import FigmaClient


async def main() -> None:
    mode = (sys.argv[1] if len(sys.argv) > 1 else "auto").lower()

    if mode == "explicit":
        client = FigmaClient(proxy={"host": os.environ.get("HTTPS_PROXY", "")})
    elif mode == "full":
        client = FigmaClient(
            proxy={
                "host": os.environ.get("HTTPS_PROXY", ""),
                "user": os.environ.get("HTTP_PROXY_USER", ""),
                "pass": os.environ.get("HTTP_PROXY_PASS", ""),
            }
        )
    else:
        client = FigmaClient(proxy={})

    try:
        me = await client.me.get()
        sys.stdout.write(f"Figma [{mode}] → @{me.get('handle')}\n")
    finally:
        await client.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Example failed: {err}\n")
        sys.exit(1)
