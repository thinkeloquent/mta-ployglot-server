"""Lock the dynamic /healthz/app-yaml-file route contract."""

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


def test_endpoint_dev_yaml_slice(client: TestClient):
    r = client.get("/healthz/app-yaml-file/server/config/endpoint.dev.yaml")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["raw"]["endpoints"]
    assert body["merged"]["endpoints"]
    assert body["applied"]["endpoints"]
    assert body["applied"]["intent_mapping"]["default_intent"] == "llm001"


def test_orphan_file_now_wired(client: TestClient):
    r = client.get("/healthz/app-yaml-file/server/config/database_schema.yaml")
    assert r.status_code == 200
    body = r.json()
    assert body["merged"]["table_prefix"] == "mta_"


def test_traversal_rejected(client: TestClient):
    r = client.get("/healthz/app-yaml-file/server/config/..%2Fetc%2Fpasswd")
    assert r.status_code == 400


def test_missing_file_404(client: TestClient):
    r = client.get("/healthz/app-yaml-file/server/config/never_existed.yaml")
    assert r.status_code == 404
