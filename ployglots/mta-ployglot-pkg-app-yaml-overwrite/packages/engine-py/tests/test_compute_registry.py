import asyncio

import pytest

from runtime_template_resolver.compute_registry import ComputeRegistry
from runtime_template_resolver.errors import ComputeFunctionError, ErrorCode
from runtime_template_resolver.options import ComputeScope


def test_register_has_list_get_scope():
    reg = ComputeRegistry()
    reg.register("alpha", lambda *_: 1, ComputeScope.STARTUP)
    reg.register("beta", lambda *_: 2)
    assert reg.has("alpha")
    assert reg.has("beta")
    assert sorted(reg.list()) == ["alpha", "beta"]
    assert reg.get_scope("alpha") == ComputeScope.STARTUP
    assert reg.get_scope("beta") == ComputeScope.REQUEST


def test_unregister_returns_bool():
    reg = ComputeRegistry()
    reg.register("x", lambda *_: 1)
    assert reg.unregister("x") is True
    assert reg.unregister("x") is False


def test_clear_removes_everything_clear_cache_only_cache():
    reg = ComputeRegistry()
    counter = {"n": 0}

    def fn(_ctx, _path):
        counter["n"] += 1
        return counter["n"]

    reg.register("cached", fn, ComputeScope.STARTUP)
    first = asyncio.run(reg.resolve("cached", {}))
    second = asyncio.run(reg.resolve("cached", {}))
    assert first == second
    reg.clear_cache()
    third = asyncio.run(reg.resolve("cached", {}))
    assert third != first
    reg.clear()
    assert not reg.has("cached")


def test_name_validation_throws_for_bad_names():
    reg = ComputeRegistry()
    with pytest.raises(ValueError, match="Invalid function name"):
        reg.register("1bad", lambda *_: 1)
    with pytest.raises(ValueError, match="Invalid function name"):
        reg.register("has-dash", lambda *_: 1)


def test_startup_caches_request_does_not():
    reg = ComputeRegistry()
    calls = {"n": 0}

    def inc(_ctx, _path):
        calls["n"] += 1
        return calls["n"]

    reg.register("startup", inc, ComputeScope.STARTUP)
    reg.register("request", inc, ComputeScope.REQUEST)
    asyncio.run(reg.resolve("startup", {}))
    asyncio.run(reg.resolve("startup", {}))
    assert calls["n"] == 1
    asyncio.run(reg.resolve("request", {}))
    asyncio.run(reg.resolve("request", {}))
    assert calls["n"] == 3


def test_startup_cache_key_includes_property_path():
    reg = ComputeRegistry()
    calls = {"n": 0}

    def keyed(_ctx, path):
        calls["n"] += 1
        return f"{path}:{calls['n']}"

    reg.register("keyed", keyed, ComputeScope.STARTUP)
    a1 = asyncio.run(reg.resolve("keyed", {}, "a"))
    a2 = asyncio.run(reg.resolve("keyed", {}, "a"))
    b1 = asyncio.run(reg.resolve("keyed", {}, "b"))
    assert a1 == a2
    assert a1 != b1


def test_unknown_name_raises_not_found():
    reg = ComputeRegistry()
    with pytest.raises(ComputeFunctionError) as exc:
        asyncio.run(reg.resolve("nope", {}))
    assert exc.value.code == ErrorCode.COMPUTE_FUNCTION_NOT_FOUND


def test_throwing_function_wraps_as_failed():
    reg = ComputeRegistry()

    def boom(_ctx, _path):
        raise RuntimeError("kaboom")

    reg.register("boom", boom)
    with pytest.raises(ComputeFunctionError) as exc:
        asyncio.run(reg.resolve("boom", {}))
    assert exc.value.code == ErrorCode.COMPUTE_FUNCTION_FAILED
    assert exc.value.ctx["original_error"] == "kaboom"


def test_async_function_is_awaited():
    reg = ComputeRegistry()

    async def async_fn(_ctx, _path):
        return "ok"

    reg.register("async_fn", async_fn)
    assert asyncio.run(reg.resolve("async_fn", {})) == "ok"
