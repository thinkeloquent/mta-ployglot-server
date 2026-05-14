"""Example: GitHub REST API v3.

Env:
    GITHUB_HOST  — usually 'https://api.github.com' (override for GHE)
    GITHUB_USER  — username (used for sanity prints; not required for token auth)
    GITHUB_PASS  — a GitHub Personal Access Token
    HTTPS_PROXY  — optional outbound proxy.

Endpoint exercised: GET /user — returns the authenticated user.

Run:
    python -m examples.integrations.github
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import AsyncClient, BearerAuth

from .._shared import build_proxy, optional_env, require_env


async def main() -> None:
    host = optional_env("GITHUB_HOST", "https://api.github.com")
    _user = optional_env("GITHUB_USER", "")  # kept for ENV symmetry
    token = require_env("GITHUB_PASS")

    proxy = build_proxy({})

    kwargs: dict = {
        "base_url": host,
        "auth": BearerAuth(token),
        "headers": {
            "accept": "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
        },
    }
    if proxy is not None:
        kwargs["proxy"] = proxy

    async with AsyncClient(**kwargs) as client:
        resp = await client.get("/user")
        resp.raise_for_status()
        me = resp.json()
        sys.stdout.write(
            f"GitHub {host} → {me.get('login')} ({me.get('name') or '<no name>'}) #{me.get('id')}\n"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"GitHub example failed: {err}\n")
        sys.exit(1)
