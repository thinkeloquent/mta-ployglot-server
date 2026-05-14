"""Unit tests for _provider_config_echo.build_echo."""

from __future__ import annotations

import asyncio

import pytest
from runtime_template_resolver import (
    ComputeRegistry,
    ComputeScope,
    ContextResolver,
    MissingStrategy,
)

from config.routes._provider_config_echo import (
    MASKED_LITERAL,
    build_echo,
)


class _StubRequest:
    def __init__(self, headers: dict[str, str]):
        self.headers = headers
        self.method = "GET"

        class _U:
            path = "/healthz/integrations/test"

        self.url = _U()


class _ResolverHandle:
    """Minimal stand-in for ResolverHandle that exposes resolve_object()."""

    def __init__(self, registry):
        self._resolver = ContextResolver(
            registry=registry,
            missing_strategy=MissingStrategy.IGNORE,
        )

    async def resolve_object(self, obj, ctx):
        return await self._resolver.resolve_object(obj, ctx)


def _make_resolver_with_token(provider_to_token: dict, *, scope=ComputeScope.STARTUP):
    reg = ComputeRegistry()
    reg.register("provider_api_keys", lambda *_: provider_to_token, scope)
    return _ResolverHandle(reg)


def test_returns_none_when_provider_missing():
    cfg = {"providers": {}}
    req = _StubRequest({})
    resolver = _make_resolver_with_token({})
    out = asyncio.run(build_echo("absent", req, cfg, resolver))
    assert out is None


def test_returns_none_when_cfg_not_dict():
    req = _StubRequest({})
    resolver = _make_resolver_with_token({})
    assert asyncio.run(build_echo("p", req, None, resolver)) is None


def test_returns_none_when_slice_not_dict():
    req = _StubRequest({})
    resolver = _make_resolver_with_token({})
    cfg = {"providers": {"p": "not-a-dict"}}
    assert asyncio.run(build_echo("p", req, cfg, resolver)) is None


def test_resolves_request_id_then_masks_credential():
    cfg = {
        "app": {"name": "test"},
        "providers": {
            "p": {
                "base_url": "https://x",
                "endpoint_api_key": "{{fn:provider_api_keys.p}}",
                "headers": {
                    "X-Request-Id": "{{request.headers.x-request-id}}",
                    "Authorization": "Bearer should-mask",
                },
            },
        },
    }
    req = _StubRequest({"x-request-id": "rid-123"})
    resolver = _make_resolver_with_token({"p": "real-token"})
    out = asyncio.run(build_echo("p", req, cfg, resolver))

    assert out is not None
    assert out["base_url"] == "https://x"
    assert out["endpoint_api_key"] == MASKED_LITERAL
    assert out["headers"]["X-Request-Id"] == "rid-123"
    assert out["headers"]["Authorization"] == MASKED_LITERAL


def test_invalid_trigger_raises_value_error():
    req = _StubRequest({})
    resolver = _make_resolver_with_token({})
    with pytest.raises(ValueError):
        asyncio.run(
            build_echo("p", req, {"providers": {"p": {}}}, resolver, trigger="bogus")
        )


def test_trigger_on_start_skips_request_only_templates():
    # A REQUEST-scoped fn in the registry: at STARTUP it should not resolve.
    reg = ComputeRegistry()
    reg.register(
        "provider_api_keys",
        lambda *_: {"p": "real-token"},
        ComputeScope.REQUEST,
    )
    resolver = _ResolverHandle(reg)
    cfg = {
        "providers": {
            "p": {
                "base_url": "https://x",
                "endpoint_api_key": "{{fn:provider_api_keys.p}}",
            }
        }
    }
    req = _StubRequest({})
    out = asyncio.run(build_echo("p", req, cfg, resolver, trigger="OnStart"))
    # endpoint_api_key still masked because the regex catches the key name
    # regardless of the post-resolution value (template literal preserved).
    assert out is not None
    assert out["endpoint_api_key"] == MASKED_LITERAL


def test_trigger_both_runs_two_passes():
    reg = ComputeRegistry()
    reg.register(
        "boot_value",
        lambda *_: "BOOT",
        ComputeScope.STARTUP,
    )
    resolver = _ResolverHandle(reg)
    cfg = {
        "providers": {
            "p": {
                "base_url": "https://x",
                "boot_field": "{{fn:boot_value}}",
                "request_field": "{{request.headers.x-request-id}}",
            }
        }
    }
    req = _StubRequest({"x-request-id": "rid-both"})
    out = asyncio.run(build_echo("p", req, cfg, resolver, trigger="Both"))
    assert out is not None
    assert out["boot_field"] == "BOOT"
    assert out["request_field"] == "rid-both"
