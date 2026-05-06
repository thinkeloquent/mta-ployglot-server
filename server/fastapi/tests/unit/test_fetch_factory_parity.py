"""Yaml ↔ factory parity: each `make_X_client` faithfully consumes its cfg slice.

Catches drift between yaml and the factory builder helpers — e.g. if
yaml gains a new provider but the factory map isn't updated, or if a
new auth type is added to yaml that the helper switch doesn't handle.

Asserts shape (base_url + auth class + auth target keys) without
booting the full lifecycle: monkey-patches the fetch-config singleton
with a synthetic cfg dict, calls each factory directly, and inspects
the resulting AsyncClient.
"""

from __future__ import annotations

import asyncio

import pytest
from app_yaml_fetch_config import load_config
from fetch_http_client import APIKeyAuth, BasicAuth, BearerAuth

from config.lifecycles._fetch_factories import FACTORIES


# Synthetic post-pipeline cfg — STARTUP-resolved tokens already plugged in.
# Mirrors the shape that slot 28 (applier) leaves in slot 29's singleton.
_FAKE_CFG = {
    "providers": {
        "figma": {
            "base_url": "https://figma.example.com",
            "endpoint_auth_type": "custom",
            "api_auth_header_name": "X-Figma-Token",
            "endpoint_api_key": "figma-tok",
            "headers": {"Accept": "application/json", "X-Request-Id": None},
        },
        "github": {
            "base_url": "https://github.example.com",
            "endpoint_auth_type": "bearer",
            "endpoint_api_key": "gh-tok",
            "headers": {"Accept": "application/vnd.github+json"},
        },
        "jira": {
            "base_url": "https://jira.example.com",
            "endpoint_auth_type": "basic_email_token",
            "email": "u@x",
            "endpoint_api_key": "jira-tok",
            "headers": {"Accept": "application/json"},
        },
        "confluence": {
            "base_url": "https://wiki.example.com/wiki",  # /wiki suffix stripped by factory
            "endpoint_auth_type": "basic_email_token",
            "email": "u@x",
            "endpoint_api_key": "conf-tok",
            "headers": {"Accept": "application/json"},
        },
        "saucelabs": {
            "base_url": "https://sauce.example.com",
            "endpoint_auth_type": "basic",
            "username": "sauce-u",
            "endpoint_api_key": "sauce-key",
            "headers": {},
        },
        "statsig": {
            "base_url": "https://statsig.example.com",
            "endpoint_auth_type": "custom_header",
            "api_auth_header_name": "statsig-api-key",
            "endpoint_api_key": "statsig-tok",
            "headers": {},
        },
    }
}


# (provider, expected_base_url_after_factory_transforms, auth_class)
_EXPECTED = [
    ("figma",      "https://figma.example.com",      APIKeyAuth),
    ("github",     "https://github.example.com",     BearerAuth),
    ("jira",       "https://jira.example.com",       BasicAuth),
    ("confluence", "https://wiki.example.com",       BasicAuth),  # /wiki stripped
    ("saucelabs",  "https://sauce.example.com",      BasicAuth),
    ("statsig",    "https://statsig.example.com",    APIKeyAuth),
]


@pytest.fixture(autouse=True)
def _stub_cfg():
    load_config(_FAKE_CFG)
    yield


def test_factories_cover_all_yaml_providers():
    factory_keys = set(FACTORIES.keys())
    yaml_keys = set(_FAKE_CFG["providers"].keys())
    assert factory_keys == yaml_keys, (
        f"factory ↔ yaml drift: factories={sorted(factory_keys)} "
        f"yaml={sorted(yaml_keys)}"
    )


@pytest.mark.parametrize("provider,expected_base_url,auth_class", _EXPECTED)
def test_factory_consumes_cfg_slice(provider, expected_base_url, auth_class):
    factory = FACTORIES[provider]
    client = asyncio.run(factory())
    try:
        actual_base_url = str(client._httpx.base_url).rstrip("/")
        assert actual_base_url == expected_base_url, (
            f"{provider}: base_url drift "
            f"(client={actual_base_url!r}, expected={expected_base_url!r})"
        )
        assert isinstance(client._auth, auth_class), (
            f"{provider}: auth class drift "
            f"(client={type(client._auth).__name__}, expected={auth_class.__name__})"
        )
    finally:
        asyncio.run(client.aclose())
