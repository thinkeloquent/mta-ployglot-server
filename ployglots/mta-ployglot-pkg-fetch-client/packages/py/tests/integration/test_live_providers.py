"""Env-gated live provider tests (GitHub, JIRA, Sauce Labs).

Each test skips itself cleanly when its credentials are missing.
"""

from __future__ import annotations

import os

import pytest

from fetch_http_client import (
    AsyncClient,
    BasicAuth,
    BearerAuth,
    TransportError,
)


def _env(*names: str) -> dict[str, str]:
    values = {name: os.environ.get(name, "") for name in names}
    if any(not v for v in values.values()):
        pytest.skip(f"missing env: {', '.join(n for n, v in values.items() if not v)}")
    return values


@pytest.mark.asyncio
async def test_github_live() -> None:
    env = _env("GITHUB_PASS")
    host = os.environ.get("GITHUB_HOST") or "https://api.github.com"
    async with AsyncClient(
        base_url=host,
        auth=BearerAuth(env["GITHUB_PASS"]),
        headers={"accept": "application/vnd.github+json"},
    ) as client:
        try:
            resp = await client.get("/user")
        except TransportError as exc:
            pytest.skip(f"network flaky: {exc}")
        resp.raise_for_status()
        me = resp.json()
        assert "login" in me


@pytest.mark.asyncio
async def test_jira_live() -> None:
    env = _env("JIRA_HOST", "JIRA_USER", "JIRA_PASS")
    async with AsyncClient(
        base_url=env["JIRA_HOST"],
        auth=BasicAuth(env["JIRA_USER"], env["JIRA_PASS"]),
        headers={"accept": "application/json"},
    ) as client:
        try:
            resp = await client.get("/rest/api/3/myself")
        except TransportError as exc:
            pytest.skip(f"network flaky: {exc}")
        resp.raise_for_status()
        me = resp.json()
        assert "accountId" in me


@pytest.mark.asyncio
async def test_saucelabs_live() -> None:
    env = _env("SAUCELABS_HOST", "SAUCELABS_USER", "SAUCELABS_PASS")
    async with AsyncClient(
        base_url=env["SAUCELABS_HOST"],
        auth=BasicAuth(env["SAUCELABS_USER"], env["SAUCELABS_PASS"]),
        headers={"accept": "application/json"},
    ) as client:
        from urllib.parse import quote

        try:
            resp = await client.get(
                f"/rest/v1/users/{quote(env['SAUCELABS_USER'], safe='')}/concurrency"
            )
        except TransportError as exc:
            pytest.skip(f"network flaky: {exc}")
        resp.raise_for_status()
        data = resp.json()
        assert "concurrency" in data
