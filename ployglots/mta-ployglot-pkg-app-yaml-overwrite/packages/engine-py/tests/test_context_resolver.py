import asyncio

import pytest

from runtime_template_resolver.context_resolver import (
    COMPUTE_PATTERN,
    ContextResolver,
    ENV_PATTERN,
    TEMPLATE_PATTERN,
    create_resolver,
    parse_default,
)
from runtime_template_resolver.errors import (
    ComputeFunctionError,
    RecursionLimitError,
    SecurityError,
)
from runtime_template_resolver.options import ComputeScope, MissingStrategy


def test_env_pattern_matches():
    assert ENV_PATTERN.match("{{env.HOME}}")
    assert ENV_PATTERN.match('{{env.MY_VAR | "fb"}}')
    assert not ENV_PATTERN.match("{{env.bad}}")


def test_compute_pattern_matches():
    assert COMPUTE_PATTERN.match("{{fn:now}}")
    assert COMPUTE_PATTERN.match('{{fn:_x | "default"}}')
    assert not COMPUTE_PATTERN.match("{{fn:1bad}}")


def test_compute_pattern_matches_dotted_accessor():
    assert COMPUTE_PATTERN.match("{{fn:startup_tokens.case_001}}")
    assert COMPUTE_PATTERN.match("{{fn:provider_api_keys.gemini_openai}}")
    assert COMPUTE_PATTERN.match('{{fn:a.b.c | "fallback"}}')


def test_template_pattern_matches():
    assert TEMPLATE_PATTERN.match("{{a.b.c}}")
    assert TEMPLATE_PATTERN.match("{{env.X}}")  # ENV must be tried first


def test_template_pattern_matches_dashed_segments():
    # Dashes in path segments (e.g. HTTP header names like x-request-id).
    assert TEMPLATE_PATTERN.match("{{request.headers.x-request-id}}")
    assert TEMPLATE_PATTERN.match("{{a.b-c.d}}")


def test_parse_default():
    assert parse_default("true") is True
    assert parse_default("false") is False
    assert parse_default("42") == 42
    assert parse_default("3.14") == 3.14
    assert parse_default("hello") == "hello"
    assert parse_default("") == ""


def test_resolve_path_lookup():
    r = ContextResolver()
    assert asyncio.run(r.resolve("{{a.b}}", {"a": {"b": 7}})) == 7
    assert (
        asyncio.run(
            r.resolve("{{a.deeply.nested.x}}", {"a": {"deeply": {"nested": {"x": "ok"}}}})
        )
        == "ok"
    )


def test_resolve_literal_passthrough():
    r = ContextResolver()
    assert asyncio.run(r.resolve("plain string", {})) == "plain string"


def test_resolve_non_string_passthrough():
    r = ContextResolver()
    assert asyncio.run(r.resolve(42, {})) == 42
    assert asyncio.run(r.resolve(None, {})) is None


def test_resolve_object_tree_walker():
    r = ContextResolver()
    result = asyncio.run(
        r.resolve_object(
            {"a": "{{x}}", "b": [{"c": "{{y}}"}], "n": 99}, {"x": 1, "y": 2}
        )
    )
    assert result == {"a": 1, "b": [{"c": 2}], "n": 99}


def test_missing_strategy_error_raises():
    r = ContextResolver(missing_strategy=MissingStrategy.ERROR)
    with pytest.raises(ComputeFunctionError):
        asyncio.run(r.resolve("{{nope}}", {}))


def test_missing_strategy_ignore_returns_literal():
    r = ContextResolver(missing_strategy=MissingStrategy.IGNORE)
    assert asyncio.run(r.resolve("{{nope}}", {})) == "{{nope}}"


def test_missing_strategy_default_returns_none():
    r = ContextResolver(missing_strategy=MissingStrategy.DEFAULT)
    assert asyncio.run(r.resolve("{{nope}}", {})) is None


def test_inline_default_takes_precedence():
    r = ContextResolver(missing_strategy=MissingStrategy.ERROR)
    assert asyncio.run(r.resolve('{{nope | "fb"}}', {})) == "fb"
    assert asyncio.run(r.resolve('{{nope | "42"}}', {})) == 42
    assert asyncio.run(r.resolve('{{nope | "true"}}', {})) is True


def test_compute_function_dispatch():
    r = ContextResolver()
    r.get_registry().register("greet", lambda *_: "hello", ComputeScope.REQUEST)
    assert asyncio.run(r.resolve("{{fn:greet}}", {})) == "hello"


def test_compute_function_dotted_accessor_slices_dict_result():
    r = ContextResolver()
    r.get_registry().register(
        "startup_tokens",
        lambda *_: {"case_001": "tok-001", "case_005": "tok-005"},
        ComputeScope.STARTUP,
    )
    assert asyncio.run(r.resolve("{{fn:startup_tokens.case_001}}", {})) == "tok-001"
    assert asyncio.run(r.resolve("{{fn:startup_tokens.case_005}}", {})) == "tok-005"


def test_compute_function_dotted_accessor_missing_returns_literal_under_ignore():
    r = ContextResolver(missing_strategy=MissingStrategy.IGNORE)
    r.get_registry().register(
        "startup_tokens",
        lambda *_: {"case_001": "tok-001"},
        ComputeScope.STARTUP,
    )
    # Accessor `.absent` doesn't exist in the result dict.
    assert (
        asyncio.run(r.resolve("{{fn:startup_tokens.absent}}", {}))
        == "{{fn:startup_tokens.absent}}"
    )


def test_template_dashed_segment_resolves_from_context():
    r = ContextResolver()
    ctx = {"request": {"headers": {"x-request-id": "abc-123"}}}
    assert asyncio.run(r.resolve("{{request.headers.x-request-id}}", ctx)) == "abc-123"


def test_request_fn_in_startup_scope_returns_literal():
    r = ContextResolver()
    r.get_registry().register("per_request", lambda *_: "value", ComputeScope.REQUEST)
    assert (
        asyncio.run(r.resolve("{{fn:per_request}}", {}, ComputeScope.STARTUP))
        == "{{fn:per_request}}"
    )


def test_security_forbidden_path_segments_throw():
    r = ContextResolver()
    with pytest.raises(SecurityError):
        asyncio.run(r.resolve("{{a.__proto__.x}}", {"a": {}}))


def test_recursion_depth_exceeds_throws():
    r = ContextResolver(max_depth=5)
    nested: dict = {"leaf": "x"}
    for _ in range(12):
        nested = {"wrap": nested}
    with pytest.raises(RecursionLimitError):
        asyncio.run(r.resolve_object(nested, {}))


def test_recursion_depth_100_succeeds():
    r = ContextResolver(max_depth=100)
    nested: dict = {"leaf": "x"}
    for _ in range(12):
        nested = {"wrap": nested}
    out = asyncio.run(r.resolve_object(nested, {}))
    assert isinstance(out, dict)


def test_create_resolver_factory():
    r = create_resolver()
    assert hasattr(r, "resolve")
    assert hasattr(r, "resolve_object")
