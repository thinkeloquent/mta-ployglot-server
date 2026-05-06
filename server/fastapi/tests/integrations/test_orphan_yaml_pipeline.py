"""Lock orphan-yaml pipeline coverage."""

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


def test_database_schema_keys_present(client: TestClient):
    handle = client.app.state.app_yaml_config
    assert handle.get("table_prefix") == "mta_"
    assert handle.get("fallback_schema") == "public"
    assert isinstance(handle.get("define_defaults"), dict)


def test_llm_rag_keys_present(client: TestClient):
    handle = client.app.state.app_yaml_config
    assert isinstance(handle.get("component_ingest"), dict)


def test_vite_keys_present(client: TestClient):
    handle = client.app.state.app_yaml_config
    assert isinstance(handle.get("default_envs"), dict)
