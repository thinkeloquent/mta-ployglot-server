"""Example: basic SDK usage — fetch the authenticated user.

Env:
    FIGMA_HOST   optional override (default https://api.figma.com)
    FIGMA_USER   optional placeholder (Figma is token-only)
    FIGMA_PASS   required Figma Personal Access Token
    HTTPS_PROXY  optional outbound proxy

Run:
    FIGMA_PASS=$YOUR_TOKEN python -m examples.sdk.basic_usage
"""

from __future__ import annotations

import asyncio
import sys

from figma_api import FigmaClient


async def main() -> None:
    # `proxy={}` auto-detects from HTTPS_PROXY / HTTP_PROXY.
    # `token` falls back to env FIGMA_PASS.
    async with FigmaClient(proxy={}) as client:
        me = await client.me.get()
        sys.stdout.write(
            f"Figma → @{me.get('handle')} <{me.get('email', '')}> ({me.get('id')})\n"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Example failed: {err}\n")
        sys.exit(1)
