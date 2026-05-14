"""Example: JIRA REST API v3.

Env:
    JIRA_HOST   — e.g. 'https://your-domain.atlassian.net'
    JIRA_USER   — your Atlassian email
    JIRA_PASS   — a JIRA API token
                  https://id.atlassian.com/manage-profile/security/api-tokens
    HTTPS_PROXY — optional outbound proxy, picked up by build_proxy({}).

Endpoint exercised: GET /rest/api/3/myself — returns the caller's profile.

Run:
    python -m examples.integrations.jira
"""

from __future__ import annotations

import asyncio
import sys

from fetch_http_client import AsyncClient, BasicAuth

from .._shared import build_proxy, require_env


async def main() -> None:
    host = require_env("JIRA_HOST")
    user = require_env("JIRA_USER")
    password = require_env("JIRA_PASS")

    # proxy={} → auto-detect from HTTPS_PROXY / HTTP_PROXY.
    # Pass {"host": ..., "user": ..., "pass": ...} to override explicitly.
    proxy = build_proxy({})

    kwargs: dict = {
        "base_url": host,
        "auth": BasicAuth(user, password),
        "headers": {"accept": "application/json"},
    }
    if proxy is not None:
        kwargs["proxy"] = proxy

    async with AsyncClient(**kwargs) as client:
        resp = await client.get("/rest/api/3/myself")
        resp.raise_for_status()
        me = resp.json()
        sys.stdout.write(
            f"JIRA {host} → {me.get('displayName')} "
            f"<{me.get('emailAddress')}> ({me.get('accountId')})\n"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        sys.stderr.write(f"JIRA example failed: {err}\n")
        sys.exit(1)
