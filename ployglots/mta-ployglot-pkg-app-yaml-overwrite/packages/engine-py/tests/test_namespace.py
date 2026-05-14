import asyncio
import os

import pytest

from runtime_template_resolver.context_resolver import ContextResolver


def test_register_namespace_overrides_env_resolve():
    r = ContextResolver()
    calls: list[tuple[str, object]] = []

    def vault_handler(var_name, default_val):
        calls.append((var_name, default_val))
        return f"vault:{var_name}"

    r.register_namespace("env", vault_handler)
    assert asyncio.run(r.resolve("{{env.DB_PASSWORD}}", {})) == "vault:DB_PASSWORD"
    assert calls == [("DB_PASSWORD", None)]


def test_unregister_namespace_restores_default():
    r = ContextResolver()
    r.register_namespace("env", lambda *_: "vault")
    assert asyncio.run(r.resolve("{{env.HOME}}", {})) == "vault"

    r.unregister_namespace("env")
    os.environ["RTR_TEST_NS"] = "default-back"
    try:
        assert asyncio.run(r.resolve("{{env.RTR_TEST_NS}}", {})) == "default-back"
    finally:
        os.environ.pop("RTR_TEST_NS", None)


def test_register_namespace_passes_default_to_handler():
    r = ContextResolver()
    received: list[object] = []

    def handler(_var_name, default_val):
        received.append(default_val)
        return "X"

    r.register_namespace("env", handler)
    asyncio.run(r.resolve('{{env.K | "42"}}', {}))
    assert received == [42]
