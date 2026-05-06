"""Lock the `config_used` field shape across all six integration health routes.

Yaml-driven assertions: rather than hard-coding expected base_url
substrings per provider, the test asks the post-pipeline cfg
(`get_config()["providers"][name]`) for each provider's resolved
`base_url` and `host` values, then asserts the route response matches.
This makes the test a contract that the route faithfully reflects yaml
without baking external knowledge of what URLs exist.

Reuses the `smoke_app` fixture from `conftest.py` which starts a local
mock origin and stubs every provider's env vars — keeps the test
offline while exercising the real lifecycle wiring (slot 26 resolver +
slot 29 fetch-config + slot 30 routes).
"""

from __future__ import annotations

import pytest

from app_yaml_fetch_config import get_config


# (provider name, route URL) — the expected `host` / `config_used.base_url`
# come from the live cfg at request time, not from hard-coded strings.
PROVIDERS = [
    ("figma",      "/healthz/integrations/figma/me"),
    ("github",     "/healthz/integrations/github/user"),
    ("jira",       "/healthz/integrations/jira/myself"),
    ("saucelabs",  "/healthz/integrations/saucelabs/rest/v1/user"),
    ("statsig",    "/healthz/integrations/statsig/gates"),
    ("confluence", "/healthz/integrations/wiki/rest/api/user/current"),
]


@pytest.mark.parametrize("provider,url", PROVIDERS)
def test_config_used_present_and_masked(smoke_app, provider, url):
    client, _mock_url = smoke_app
    expected_base_url = (
        get_config().get("providers", {}).get(provider, {}).get("base_url")
    )
    assert expected_base_url, (
        f"{provider}: cfg.providers.{provider}.base_url empty — yaml or applier broken"
    )

    rid = f"sentinel-rid-{provider}"
    r = client.get(url, headers={"x-request-id": rid})
    body = r.json()

    assert body.get("host") == expected_base_url, (
        f"{provider}: route host mismatch (got {body.get('host')!r}, "
        f"expected {expected_base_url!r} from cfg)"
    )

    cu = body.get("config_used")
    assert cu is not None, f"{provider}: config_used missing (body={body!r})"
    assert cu.get("base_url") == expected_base_url, (
        f"{provider}: config_used.base_url mismatch (got {cu.get('base_url')!r}, "
        f"expected {expected_base_url!r} from cfg)"
    )
    assert cu.get("endpoint_api_key") == "***", (
        f"{provider}: api key not masked (got {cu.get('endpoint_api_key')!r})"
    )
    headers = cu.get("headers") or {}
    rid_observed = headers.get("X-Request-Id") or headers.get("x-request-id")
    assert rid_observed == rid, (
        f"{provider}: x-request-id not echoed (got {rid_observed!r})"
    )
