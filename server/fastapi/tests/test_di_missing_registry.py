"""Confirm get_X_client raises a helpful error when the lifespan hook didn't run."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from config.routes._di import get_jira_client


def test_missing_registry_raises():
    fake_request = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(fetch_clients=None))
    )
    with pytest.raises(RuntimeError, match="FetchClientRegistry missing"):
        asyncio.run(get_jira_client(fake_request))  # type: ignore[arg-type]
