"""Tree walker that resolves overwrite_from_context / overwrite_from_env sections."""

from __future__ import annotations

import copy
import inspect
import os
from typing import Any

from .deep_merge_null import deep_merge_with_null_replace
from .default_resolver import default_resolver

SECTION_FROM_CONTEXT = "overwrite_from_context"
SECTION_FROM_ENV = "overwrite_from_env"


def _is_plain_dict(v: Any) -> bool:
    return isinstance(v, dict)


def _lookup_env(env_section: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if not _is_plain_dict(env_section):
        return out
    for key, var_name in env_section.items():
        if not isinstance(var_name, str):
            continue
        v = os.environ.get(var_name)
        if v is not None:
            out[key] = v
    return out


async def _walk(node: Any, ctx: dict[str, Any]) -> Any:
    if isinstance(node, list):
        return [await _walk(v, ctx) for v in node]
    if not _is_plain_dict(node):
        return node

    result: dict[str, Any] = {}
    for key in node.keys():
        if key in (SECTION_FROM_CONTEXT, SECTION_FROM_ENV):
            continue
        result[key] = await _walk(node[key], ctx)

    if _is_plain_dict(node.get(SECTION_FROM_ENV)):
        env_values = _lookup_env(node[SECTION_FROM_ENV])
        result = deep_merge_with_null_replace(result, env_values)
        result[SECTION_FROM_ENV] = copy.deepcopy(node[SECTION_FROM_ENV])

    if _is_plain_dict(node.get(SECTION_FROM_CONTEXT)):
        resolver = ctx["resolver"]
        coro = resolver.resolve_object(
            node[SECTION_FROM_CONTEXT],
            ctx["context"],
            ctx.get("scope"),
        ) if ctx.get("scope") is not None else resolver.resolve_object(
            node[SECTION_FROM_CONTEXT],
            ctx["context"],
        )
        if inspect.isawaitable(coro):
            resolved = await coro
        else:
            resolved = coro
        result = deep_merge_with_null_replace(result, resolved)
        result[SECTION_FROM_CONTEXT] = resolved

    return result


async def apply_overwrites_from_context(
    config: Any,
    *,
    resolver: Any = None,
    context: dict[str, Any] | None = None,
    scope: Any = None,
    missing_strategy: Any = None,  # noqa: ARG001 - reserved for parity with mjs
) -> Any:
    """Resolve `overwrite_from_*` sections in `config` and return a new tree.

    - `resolver` — duck-typed `{ resolve, resolve_object }`. Defaults to the engine via
      `runtime_template_resolver.create_resolver()`.
    - `context` — value object passed to the resolver for `{{path}}` lookups.
    - `scope` — passed through to `resolver.resolve_object` (`ComputeScope.STARTUP`/`REQUEST`).
    """
    rsv = resolver if resolver is not None else default_resolver()
    ctx = {"resolver": rsv, "context": context or {}, "scope": scope}
    return await _walk(config, ctx)
