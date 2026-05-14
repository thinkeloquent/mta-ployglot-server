import json

from app_yaml_fetch_config import (
    create_endpoint_config,
    create_fetch_config,
    createEndpointConfig,
    createFetchConfig,
)


def test_create_endpoint_config_defaults():
    ep = create_endpoint_config({}, "svc1")
    assert ep["key"] == "svc1"
    assert ep["name"] == "svc1"
    assert ep["tags"] == []
    assert ep["baseUrl"] == ""
    assert ep["description"] == ""
    assert ep["method"] == "POST"
    assert ep["headers"] == {}
    assert ep["timeout"] == 30000
    assert ep["bodyType"] == "json"


def test_create_endpoint_config_custom_values():
    ep = create_endpoint_config(
        {"name": "gemini", "tags": ["llm"], "method": "GET", "timeout": 5000, "bodyType": "text"},
        "k",
    )
    assert ep["name"] == "gemini"
    assert ep["tags"] == ["llm"]
    assert ep["method"] == "GET"
    assert ep["timeout"] == 5000
    assert ep["bodyType"] == "text"


def test_create_endpoint_config_baseurl_legacy_alias():
    assert create_endpoint_config({"baseUrl": "A", "baseurl": "B"})["baseUrl"] == "A"
    assert create_endpoint_config({"baseurl": "B"})["baseUrl"] == "B"


def test_create_endpoint_config_input_not_mutated():
    inp = {"name": "x", "tags": ["a"], "headers": {"H": "1"}}
    snapshot = json.dumps(inp, sort_keys=True)
    create_endpoint_config(inp, "k")
    assert json.dumps(inp, sort_keys=True) == snapshot


def test_create_endpoint_config_deep_cloned_tags_headers():
    inp = {"tags": ["t"], "headers": {"H": "1"}}
    ep = create_endpoint_config(inp, "k")
    ep["tags"].append("mutated")
    ep["headers"]["H"] = "mutated"
    assert inp["tags"] == ["t"]
    assert inp["headers"] == {"H": "1"}


def test_create_fetch_config_timeout_renamed():
    fc = create_fetch_config(
        serviceId="svc",
        url="https://x",
        method="POST",
        headers={"A": "1"},
        body='{"k":1}',
        timeout=7000,
    )
    assert sorted(fc.keys()) == ["body", "headers", "headersTimeout", "method", "serviceId", "url"]
    assert fc["headersTimeout"] == 7000
    assert "timeout" not in fc


def test_camel_case_aliases_exported():
    # parity: createEndpointConfig + createFetchConfig also work
    assert createEndpointConfig({}, "k")["key"] == "k"
    fc = createFetchConfig(
        serviceId="s", url="u", method="m", headers={}, body="b", timeout=1
    )
    assert fc["serviceId"] == "s"
