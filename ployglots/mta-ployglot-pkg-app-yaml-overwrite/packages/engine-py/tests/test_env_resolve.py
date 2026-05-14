import asyncio
import os

import pytest

from runtime_template_resolver.context_resolver import ContextResolver


@pytest.fixture(autouse=True)
def _scrub_env():
    keys = ["RTR_TEST_SET", "RTR_TEST_MISSING", "RTR_TEST_BOTH", "RTR_X"]
    for k in keys:
        os.environ.pop(k, None)
    yield
    for k in keys:
        os.environ.pop(k, None)


def test_env_set_returns_value():
    os.environ["RTR_TEST_SET"] = "alice"
    r = ContextResolver()
    assert asyncio.run(r.resolve("{{env.RTR_TEST_SET}}", {})) == "alice"


def test_env_missing_with_string_default():
    r = ContextResolver()
    assert asyncio.run(r.resolve('{{env.RTR_TEST_MISSING | "fb"}}', {})) == "fb"


def test_env_missing_with_numeric_default():
    r = ContextResolver()
    assert asyncio.run(r.resolve('{{env.RTR_TEST_MISSING | "42"}}', {})) == 42


def test_env_missing_with_boolean_default():
    r = ContextResolver()
    assert asyncio.run(r.resolve('{{env.RTR_TEST_MISSING | "true"}}', {})) is True


def test_env_set_prefers_actual_value():
    os.environ["RTR_TEST_BOTH"] = "real"
    r = ContextResolver()
    assert asyncio.run(r.resolve('{{env.RTR_TEST_BOTH | "ignored"}}', {})) == "real"


def test_env_string_default():
    r = ContextResolver()
    assert asyncio.run(r.resolve('{{env.RTR_X | "literal"}}', {})) == "literal"
