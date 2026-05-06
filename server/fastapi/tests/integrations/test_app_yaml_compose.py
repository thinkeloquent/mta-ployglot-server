"""Integration test for the F06 app-yaml compose chain.

Deviation from plan: tests live under `tests/integrations/` (mirrors the existing
fastapi convention), not `tests/integration/`.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from main import build_app


@pytest.fixture(scope="module")
def client():
    app = asyncio.run(build_app())
    with TestClient(app) as c:
        yield c


def test_healthz_app_yaml_returns_fetch_config(client):
    response = client.get("/healthz/app-yaml/llm001")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]
    assert isinstance(body["data"], dict)


def test_healthz_app_yaml_unknown_intent_404s(client):
    response = client.get("/healthz/app-yaml/nonexistent_intent")
    assert response.status_code == 404
