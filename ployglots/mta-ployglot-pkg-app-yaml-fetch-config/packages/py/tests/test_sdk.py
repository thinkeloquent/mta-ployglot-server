from pathlib import Path

import pytest

from app_yaml_fetch_config import (
    ConfigError,
    EndpointConfigSDK,
    createEndpointConfigSDK,
    create_endpoint_config_sdk,
    load_config,
)

FIXTURE = {
    "endpoints": {
        "llm001": {
            "name": "Gemini",
            "tags": ["llm", "fast"],
            "baseUrl": "https://api.example.com/v1/chat",
            "method": "POST",
            "headers": {"Authorization": "Bearer XYZ"},
            "timeout": 8000,
            "bodyType": "json",
        },
        "llm002": {
            "name": "OpenAI",
            "tags": ["llm", "slow"],
            "baseUrl": "https://api.alt.com/v1/chat",
            "method": "POST",
            "timeout": 12000,
        },
        "raw": {
            "name": "plaintext",
            "tags": ["raw"],
            "baseUrl": "https://api.example.com/v1/raw",
            "bodyType": "text",
        },
    },
    "intent_mapping": {
        "default_intent": "llm001",
        "mappings": {"storybook": "llm002", "summary": "llm001"},
    },
}


def test_constructor_stores_file_path():
    sdk = EndpointConfigSDK({"filePath": "./e.yaml"})
    assert isinstance(sdk, EndpointConfigSDK)


def test_factory_snake_and_camel_case_both_exposed():
    a = create_endpoint_config_sdk({"filePath": "./e.yaml"})
    b = createEndpointConfigSDK({"filePath": "./e.yaml"})
    assert isinstance(a, EndpointConfigSDK)
    assert isinstance(b, EndpointConfigSDK)


def test_load_config_proxies_to_module():
    sdk = create_endpoint_config_sdk()
    ret = sdk.load_config(FIXTURE)
    assert ret is FIXTURE


def test_get_by_key_matches_module_get_endpoint():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    ep = sdk.get_by_key("llm001")
    assert ep["key"] == "llm001"
    assert ep["name"] == "Gemini"


def test_get_all_returns_three_endpoints():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    keys = sorted(ep["key"] for ep in sdk.get_all())
    assert keys == ["llm001", "llm002", "raw"]


def test_get_by_name_matches_or_returns_none():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    assert sdk.get_by_name("Gemini")["key"] == "llm001"
    assert sdk.get_by_name("Nope") is None


def test_get_by_tag_filters_by_membership():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    assert sorted(ep["key"] for ep in sdk.get_by_tag("llm")) == ["llm001", "llm002"]
    assert [ep["key"] for ep in sdk.get_by_tag("raw")] == ["raw"]
    assert sdk.get_by_tag("nope") == []


def test_list_keys_matches_module():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    assert sorted(sdk.list_keys()) == ["llm001", "llm002", "raw"]


def test_properties_walks_dot_path():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    assert sdk.properties("endpoints.llm001.timeout") == 8000
    assert sdk.properties("endpoints.llm001.name") == "Gemini"
    assert sdk.properties("endpoints.nope.timeout", "fallback") == "fallback"
    assert sdk.properties("zzz.does.not.exist", 42) == 42


def test_resolve_intent_returns_key_and_endpoint():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    r = sdk.resolve_intent("storybook")
    assert r["key"] == "llm002"
    assert r["endpoint"]["key"] == "llm002"
    assert r["endpoint"]["name"] == "OpenAI"


def test_resolve_intent_unmapped_uses_default():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    r = sdk.resolve_intent("unknown")
    assert r["key"] == "llm001"
    assert r["endpoint"]["key"] == "llm001"


def test_get_fetch_config_proxies_to_module():
    load_config(FIXTURE)
    sdk = create_endpoint_config_sdk()
    fc = sdk.get_fetch_config("llm001", {"prompt": "hi"})
    assert fc["url"] == "https://api.example.com/v1/chat"
    assert fc["body"] == '{"prompt": "hi"}'


def test_refresh_config_without_file_path_raises():
    sdk = create_endpoint_config_sdk()
    with pytest.raises(RuntimeError):
        sdk.refresh_config()


def test_load_from_file_then_refresh(tmp_path: Path):
    f = tmp_path / "e.yaml"
    f.write_text(
        "endpoints:\n  one:\n    baseUrl: https://x\nintent_mapping:\n  default_intent: one\n",
        encoding="utf-8",
    )
    sdk = create_endpoint_config_sdk()
    cfg1 = sdk.load_from_file(str(f))
    assert cfg1["endpoints"]["one"]["baseUrl"] == "https://x"

    f.write_text(
        "endpoints:\n  one:\n    baseUrl: https://y\nintent_mapping:\n  default_intent: one\n",
        encoding="utf-8",
    )
    cfg2 = sdk.refresh_config()
    assert cfg2["endpoints"]["one"]["baseUrl"] == "https://y"


def test_state_isolation_via_load_empty():
    load_config({})
    sdk = create_endpoint_config_sdk()
    assert sdk.list_keys() == []
    assert sdk.get_all() == []
    with pytest.raises(ConfigError):
        sdk.get_fetch_config("nope", {})


def test_camel_case_aliases_work():
    load_config(FIXTURE)
    sdk = createEndpointConfigSDK({"filePath": "./e.yaml"})
    assert sdk.getByKey("llm001")["key"] == "llm001"
    assert sorted(sdk.listKeys()) == ["llm001", "llm002", "raw"]
    assert sdk.getByName("Gemini")["key"] == "llm001"
    fc = sdk.getFetchConfig("llm001", {"x": 1})
    assert fc["serviceId"] == "llm001"
