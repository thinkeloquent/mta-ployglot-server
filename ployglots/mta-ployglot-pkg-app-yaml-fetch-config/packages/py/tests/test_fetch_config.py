import pytest

from app_yaml_fetch_config import ConfigError, get_fetch_config, load_config

FIXTURE = {
    "endpoints": {
        "llm001": {
            "baseUrl": "https://api.example.com/v1/chat",
            "method": "POST",
            "headers": {"Authorization": "Bearer XYZ"},
            "timeout": 8000,
            "bodyType": "json",
        },
        "plaintext": {
            "baseUrl": "https://api.example.com/v1/raw",
            "method": "POST",
            "headers": {},
            "timeout": 5000,
            "bodyType": "text",
        },
        "typed": {
            "baseUrl": "https://api.example.com/v1/x",
            "method": "PUT",
            "headers": {"Content-Type": "application/xml"},
            "bodyType": "json",
        },
    },
    "intent_mapping": {},
}


def test_happy_path_six_fields():
    load_config(FIXTURE)
    fc = get_fetch_config("llm001", {"prompt": "Hello"})
    assert fc["serviceId"] == "llm001"
    assert fc["url"] == "https://api.example.com/v1/chat"
    assert fc["method"] == "POST"
    assert fc["body"] == '{"prompt": "Hello"}'
    assert fc["headersTimeout"] == 8000
    assert fc["headers"]["Content-Type"] == "application/json"
    assert fc["headers"]["Authorization"] == "Bearer XYZ"


def test_header_merge_order_defaults_endpoint_custom():
    load_config(FIXTURE)
    fc = get_fetch_config(
        "llm001",
        {},
        {"Authorization": "Bearer OVERRIDE", "X-Trace-Id": "abc"},
    )
    assert fc["headers"]["Authorization"] == "Bearer OVERRIDE"
    assert fc["headers"]["X-Trace-Id"] == "abc"
    assert fc["headers"]["Content-Type"] == "application/json"


def test_endpoint_content_type_overrides_default():
    load_config(FIXTURE)
    fc = get_fetch_config("typed", {})
    assert fc["headers"]["Content-Type"] == "application/xml"


def test_body_type_text_uses_str_coercion():
    load_config(FIXTURE)
    fc = get_fetch_config("plaintext", "plain string")
    assert fc["body"] == "plain string"


def test_body_type_json_default_serializes():
    load_config(FIXTURE)
    fc = get_fetch_config("llm001", {"a": 1, "b": [2, 3]})
    assert fc["body"] == '{"a": 1, "b": [2, 3]}'


def test_dotted_prefix_accepted():
    load_config(FIXTURE)
    fc = get_fetch_config("endpoints.llm001", {})
    assert fc["serviceId"] == "llm001"


def test_unknown_id_raises_with_service_id_and_available():
    load_config(FIXTURE)
    with pytest.raises(ConfigError) as exc_info:
        get_fetch_config("nope", {})
    err = exc_info.value
    assert err.service_id == "nope"
    assert err.serviceId == "nope"  # parity alias
    assert sorted(err.available) == ["llm001", "plaintext", "typed"]
