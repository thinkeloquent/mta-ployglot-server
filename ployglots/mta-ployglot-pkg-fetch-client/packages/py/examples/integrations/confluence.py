"""Example: Confluence Cloud REST API v2.

Env:
    CONFLUENCE_HOST  — e.g. 'https://your-domain.atlassian.net/wiki'
    CONFLUENCE_USER  — your Atlassian email
    CONFLUENCE_PASS  — a Confluence API token
    HTTPS_PROXY      — optional outbound proxy.

Endpoint exercised: GET /api/v2/spaces?limit=5 — first 5 spaces visible to caller.

Run:
    python -m examples.integrations.confluence
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import AsyncClient, BasicAuth

from .._shared import build_proxy, require_env


async def main() -> None:
    host = require_env("CONFLUENCE_HOST")
    user = require_env("CONFLUENCE_USER")
    password = require_env("CONFLUENCE_PASS")

    proxy = build_proxy({})

    kwargs: dict = {
        "base_url": host,
        "auth": BasicAuth(user, password),
        "headers": {"accept": "application/json"},
    }
    if proxy is not None:
        kwargs["proxy"] = proxy

    async with AsyncClient(**kwargs) as client:
        resp = await client.get("/api/v2/spaces", params={"limit": 5})
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        sys.stdout.write(f"Confluence {host} → {len(results)} spaces:\n")
        for space in results:
            sys.stdout.write(f"  - {space.get('key')}: {space.get('name')} ({space.get('id')})\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Confluence example failed: {err}\n")
        sys.exit(1)
