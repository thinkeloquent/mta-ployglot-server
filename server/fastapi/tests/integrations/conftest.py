"""Shared fixture: live FastAPI app + mock origin."""

from __future__ import annotations

import asyncio
import os

import pytest
from fastapi.testclient import TestClient

from main import build_app

from ._mock_origin import start_mock


PROVIDER_ENV = {
    # provider: (base_url_key, *credential_keys)
    "jira":      ("JIRA_BASE_URL",       "JIRA_EMAIL",       "JIRA_API_TOKEN"),
    "confluence": ("CONFLUENCE_BASE_URL", "CONFLUENCE_EMAIL", "CONFLUENCE_API_TOKEN"),
    "github":    ("GITHUB_API_BASE_URL",                     "GITHUB_TOKEN"),
    "figma":     ("FIGMA_API_BASE_URL",                      "FIGMA_TOKEN"),
    "statsig":   ("STATSIG_BASE_URL",                        "STATSIG_API_KEY"),
    "saucelabs": ("SAUCELABS_BASE_URL",  "SAUCE_USERNAME",   "SAUCE_ACCESS_KEY"),
}


@pytest.fixture()
def smoke_app():
    mock_url, stop_mock = start_mock()
    saved: dict[str, str | None] = {}
    try:
        for keys in PROVIDER_ENV.values():
            host_key = keys[0]
            saved[host_key] = os.environ.get(host_key)
            os.environ[host_key] = mock_url
            for k in keys[1:]:
                saved[k] = os.environ.get(k)
                os.environ.setdefault(k, "x")
        app = asyncio.run(build_app())
        with TestClient(app) as client:
            yield client, mock_url
    finally:
        stop_mock()
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
