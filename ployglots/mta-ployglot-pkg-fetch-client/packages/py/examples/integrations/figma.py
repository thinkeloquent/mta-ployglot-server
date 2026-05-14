"""Example: Figma REST API.

Env:
    FIGMA_HOST  — usually 'https://api.figma.com'
    FIGMA_USER  — placeholder (Figma uses token auth only; kept for symmetry)
    FIGMA_PASS  — a Figma Personal Access Token
    HTTPS_PROXY — optional outbound proxy.

Endpoint exercised: GET /v1/me — returns the authenticated user.

Run:
    python -m examples.integrations.figma
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import APIKeyAuth, AsyncClient

from .._shared import build_proxy, optional_env, require_env


async def main() -> None:
    host = optional_env("FIGMA_HOST", "https://api.figma.com")
    _user = optional_env("FIGMA_USER", "")  # kept for ENV symmetry
    token = require_env("FIGMA_PASS")

    proxy = build_proxy({})

    kwargs: dict = {
        "base_url": host,
        # Figma uses the X-Figma-Token header (not Authorization).
        "auth": APIKeyAuth(token, "X-Figma-Token"),
        "headers": {"accept": "application/json"},
    }
    if proxy is not None:
        kwargs["proxy"] = proxy

    async with AsyncClient(**kwargs) as client:
        resp = await client.get("/v1/me")
        resp.raise_for_status()
        me = resp.json()
        sys.stdout.write(
            f"Figma {host} → @{me.get('handle')} <{me.get('email')}> ({me.get('id')})\n"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Figma example failed: {err}\n")
        sys.exit(1)
