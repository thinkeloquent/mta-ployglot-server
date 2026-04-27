"""Verify that app.dependency_overrides[get_jira_client] swaps the upstream call."""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

from main import build_app
from config.routes._di import get_jira_client


class _StubResp:
    status_code = 200
    status = "OK"

    def raise_for_status(self):
        return self

    def json(self):
        return {
            "accountId": "stub-acc",
            "displayName": "Stub",
            "emailAddress": "s@x",
        }


class _StubClient:
    async def get(self, _path, **_kw):
        return _StubResp()

    async def aclose(self):
        pass


def test_jira_myself_with_override():
    app = asyncio.run(build_app())
    stub = _StubClient()

    async def override():
        return stub

    app.dependency_overrides[get_jira_client] = override

    with TestClient(app) as c:
        r = c.get("/healthz/integrations/jira/myself")
        assert r.status_code == 200
        body = r.json()
        assert body["service"] == "jira"
        assert body["data"]["accountId"] == "stub-acc"
