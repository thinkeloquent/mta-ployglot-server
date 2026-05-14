"""Example: Statsig Console API.

https://docs.statsig.com/console-api/introduction

Env:
    STATSIG_HOST  — usually 'https://statsigapi.net'
    STATSIG_USER  — placeholder (Statsig uses token-only auth; kept for symmetry)
    STATSIG_PASS  — a Console API key (server secret)
    HTTPS_PROXY   — optional outbound proxy.

Endpoint exercised: GET /console/v1/feature_gates — first page of gates.

Run:
    python -m examples.integrations.statsig
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import APIKeyAuth, AsyncClient

from .._shared import build_proxy, optional_env, require_env


async def main() -> None:
    host = optional_env("STATSIG_HOST", "https://statsigapi.net")
    _user = optional_env("STATSIG_USER", "")  # kept for ENV symmetry
    token = require_env("STATSIG_PASS")

    proxy = build_proxy({})

    kwargs: dict = {
        "base_url": host,
        # Statsig Console API uses the STATSIG-API-KEY header.
        "auth": APIKeyAuth(token, "STATSIG-API-KEY"),
        "headers": {"accept": "application/json"},
    }
    if proxy is not None:
        kwargs["proxy"] = proxy

    async with AsyncClient(**kwargs) as client:
        resp = await client.get("/console/v1/feature_gates")
        resp.raise_for_status()
        data = resp.json()
        gates = data.get("data", [])
        sys.stdout.write(f"Statsig {host} → {len(gates)} feature gates:\n")
        for g in gates[:5]:
            sys.stdout.write(f"  - {g.get('id')} ({g.get('name')}) enabled={g.get('isEnabled')}\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Statsig example failed: {err}\n")
        sys.exit(1)
