"""Smoke: every /healthz/integrations/<provider>/<action> route returns the expected shape against the mock origin."""

from __future__ import annotations

import pytest


PROVIDERS = [
    ("jira", "/healthz/integrations/jira/myself", "data"),
    ("confluence", "/healthz/integrations/wiki/rest/api/user/current", "data"),
    ("github", "/healthz/integrations/github/user", "data"),
    ("figma", "/healthz/integrations/figma/me", "data"),
    ("statsig", "/healthz/integrations/statsig/gates", "gates"),
    ("saucelabs", "/healthz/integrations/saucelabs/rest/v1/user", "org_vms"),
]


@pytest.mark.parametrize("name, url, data_key", PROVIDERS)
def test_provider_shape(smoke_app, name, url, data_key):
    client, _mock_url = smoke_app
    r = client.get(url)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["service"] == name
    assert data_key in body
