"""Lock the /healthz/app-yaml-stage route family."""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from main import build_app

STAGES = ("raw", "merged", "applied", "derived")


@pytest.fixture(scope="module")
def client():
    app = asyncio.run(build_app())
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("stage", STAGES)
def test_stage_returns_200(client: TestClient, stage: str):
    r = client.get(f"/healthz/app-yaml-stage/{stage}")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["stage"] == stage
    assert body["data"] is not None


def test_unknown_stage_400(client: TestClient):
    r = client.get("/healthz/app-yaml-stage/bogus")
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert detail["valid_stages"] == list(STAGES)


def test_merged_keys_subset_of_applied(client: TestClient):
    merged = client.get("/healthz/app-yaml-stage/merged").json()["data"]
    applied = client.get("/healthz/app-yaml-stage/applied").json()["data"]
    for k in merged.keys():
        assert k in applied, f"applied missing key {k}"


def test_derived_shape(client: TestClient):
    body = client.get("/healthz/app-yaml-stage/derived").json()
    data = body["data"]
    assert isinstance(data["endpoint_keys"], list)
    assert isinstance(data["intent_resolutions"], dict)
    assert data["default_intent"] == "llm001"
