"""Unit tests for _provider_config_echo._mask — credential + header masking."""

from __future__ import annotations

from config.routes._provider_config_echo import (
    MASKED_LITERAL,
    _mask,
)


def test_credential_key_at_top_level_is_masked():
    out = _mask({"endpoint_api_key": "leaked", "base_url": "https://x"})
    assert out == {"endpoint_api_key": MASKED_LITERAL, "base_url": "https://x"}


def test_credential_key_with_underscore_prefix_is_masked():
    out = _mask({"client_secret": "s", "service_password": "p", "user_token": "t"})
    assert out == {
        "client_secret": MASKED_LITERAL,
        "service_password": MASKED_LITERAL,
        "user_token": MASKED_LITERAL,
    }


def test_credential_key_nested_is_masked():
    out = _mask({"a": {"b": {"api_token": "deep"}}})
    assert out["a"]["b"]["api_token"] == MASKED_LITERAL


def test_authorization_header_is_masked():
    out = _mask({"headers": {"Authorization": "Bearer s", "Content-Type": "json"}})
    assert out["headers"]["Authorization"] == MASKED_LITERAL
    assert out["headers"]["Content-Type"] == "json"


def test_authorization_header_case_insensitive():
    out = _mask({"headers": {"authorization": "Bearer s"}})
    assert out["headers"]["authorization"] == MASKED_LITERAL


def test_x_api_key_header_is_masked():
    out = _mask({"headers": {"X-API-Key": "k", "X-Custom": "ok"}})
    assert out["headers"]["X-API-Key"] == MASKED_LITERAL
    assert out["headers"]["X-Custom"] == "ok"


def test_non_credential_keys_pass_through():
    inp = {"base_url": "https://x", "method": "GET", "timeout_ms": 5000}
    assert _mask(inp) == inp


def test_input_is_not_mutated():
    inp = {"endpoint_api_key": "leaked"}
    _mask(inp)
    assert inp == {"endpoint_api_key": "leaked"}


def test_list_values_are_walked():
    out = _mask({"items": [{"api_key": "x"}, {"id": "y"}]})
    assert out["items"][0]["api_key"] == MASKED_LITERAL
    assert out["items"][1]["id"] == "y"
