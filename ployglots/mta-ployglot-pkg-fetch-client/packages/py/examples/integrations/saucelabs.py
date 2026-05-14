"""Example: Sauce Labs REST API.

Env:
    SAUCELABS_HOST  — region endpoint, e.g. 'https://api.us-west-1.saucelabs.com'
    SAUCELABS_USER  — your Sauce Labs username
    SAUCELABS_PASS  — your Sauce Labs access key
    HTTPS_PROXY     — optional outbound proxy.

Endpoint exercised:
    GET /rest/v1/users/{user}/concurrency — concurrency limits for the user.

Run:
    python -m examples.integrations.saucelabs
"""

from __future__ import annotations

import asyncio
import sys
from urllib.parse import quote

from fetch_http_client import AsyncClient, BasicAuth

from .._shared import build_proxy, require_env


async def main() -> None:
    host = require_env("SAUCELABS_HOST")
    user = require_env("SAUCELABS_USER")
    password = require_env("SAUCELABS_PASS")

    proxy = build_proxy({})

    kwargs: dict = {
        "base_url": host,
        "auth": BasicAuth(user, password),
        "headers": {"accept": "application/json"},
    }
    if proxy is not None:
        kwargs["proxy"] = proxy

    async with AsyncClient(**kwargs) as client:
        resp = await client.get(f"/rest/v1/users/{quote(user, safe='')}/concurrency")
        resp.raise_for_status()
        data = resp.json()
        org_vms = data["concurrency"]["organization"]["allowed"]["vms"]
        team_vms = data["concurrency"]["team"]["allowed"]["vms"]
        sys.stdout.write(
            f"Sauce Labs {host} → user {user}: org VMs={org_vms}, team VMs={team_vms}\n"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"Sauce Labs example failed: {err}\n")
        sys.exit(1)
