"""ContextResolver — recognises {{path}}, {{fn:NAME}}, {{env.VAR}} patterns."""

from __future__ import annotations

import inspect
import re
from typing import Any, Callable

from env_resolve import resolve as env_resolve

from .compute_registry import ComputeRegistry
from .errors import (
    ComputeFunctionError,
    ErrorCode,
    RecursionLimitError,
)
from .options import ComputeScope, MissingStrategy
from .security import Security

ENV_PATTERN = re.compile(r"^\{\{env\.([A-Z_][A-Z0-9_]*)(\s*\|\s*['\"](.*)['\"])?\}\}$")
# `fn:NAME` or `fn:NAME.dotted.accessor` — accessor is sliced off the result.
COMPUTE_PATTERN = re.compile(
    r"^\{\{fn:([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_-]*)*)(\s*\|\s*['\"](.*)['\"])?\}\}$"
)
# Path segments may contain dashes (e.g. `request.headers.x-request-id`).
TEMPLATE_PATTERN = re.compile(r"^\{\{([a-zA-Z0-9_.\-]*)(\s*\|\s*['\"](.*)['\"])?\}\}$")

_INT_RE = re.compile(r"^-?\d+$")
_FLOAT_RE = re.compile(r"^-?\d+\.\d+$")


def parse_default(val: Any) -> Any:
    if val is None:
        return None
    if val == "true":
        return True
    if val == "false":
        return False
    if isinstance(val, str):
        if _INT_RE.match(val):
            return int(val)
        if _FLOAT_RE.match(val):
            return float(val)
    return val


def _lodash_get(obj: Any, path: str) -> Any:
    """Equivalent of lodash.get — dotted path traversal returning None on miss."""
    if not path:
        return obj
    cur = obj
    for part in path.split("."):
        if cur is None:
            return None
        if isinstance(cur, dict):
            if part not in cur:
                return None
            cur = cur[part]
        else:
            cur = getattr(cur, part, None)
            if cur is None:
                return None
    return cur


class ContextResolver:
    def __init__(
        self,
        registry: ComputeRegistry | None = None,
        missing_strategy: MissingStrategy = MissingStrategy.ERROR,
        max_depth: int = 10,
    ) -> None:
        self.registry = registry or ComputeRegistry()
        self.missing_strategy = missing_strategy
        self.max_depth = max_depth
        self._namespaces: dict[str, Callable[[str, Any], Any]] = {}

    def get_registry(self) -> ComputeRegistry:
        return self.registry

    def register_namespace(self, prefix: str, handler: Callable[[str, Any], Any]) -> None:
        if not isinstance(prefix, str) or not prefix:
            raise ValueError("Namespace prefix must be a non-empty string")
        if not callable(handler):
            raise ValueError("Namespace handler must be callable")
        self._namespaces[prefix] = handler

    def unregister_namespace(self, prefix: str) -> bool:
        return self._namespaces.pop(prefix, None) is not None

    async def resolve(
        self,
        expression: Any,
        context: Any,
        scope: ComputeScope = ComputeScope.REQUEST,
        depth: int = 0,
    ) -> Any:
        if not isinstance(expression, str):
            return expression
        if depth > self.max_depth:
            raise RecursionLimitError(
                f"Recursion limit exceeded (max_depth={self.max_depth})",
                {"expression": expression, "depth": depth},
            )

        m = ENV_PATTERN.match(expression)
        if m:
            return await self._resolve_env(m, expression)

        m = COMPUTE_PATTERN.match(expression)
        if m:
            return await self._resolve_compute(m, context, scope, expression)

        m = TEMPLATE_PATTERN.match(expression)
        if m:
            return self._resolve_template(m, context, expression)

        return expression

    async def resolve_object(
        self,
        obj: Any,
        context: Any,
        scope: ComputeScope = ComputeScope.REQUEST,
        depth: int = 0,
    ) -> Any:
        if depth > self.max_depth:
            raise RecursionLimitError(
                f"Recursion limit exceeded (max_depth={self.max_depth})",
                {"depth": depth},
            )
        if isinstance(obj, list):
            return [
                await self.resolve_object(v, context, scope, depth + 1) for v in obj
            ]
        if isinstance(obj, dict):
            out: dict[str, Any] = {}
            for k in obj.keys():
                out[k] = await self.resolve_object(obj[k], context, scope, depth + 1)
            return out
        if isinstance(obj, str):
            return await self.resolve(obj, context, scope, depth)
        return obj

    async def _resolve_env(self, match: re.Match[str], expression: str) -> Any:
        var_name = match.group(1)
        default_raw = match.group(3)
        default_val = parse_default(default_raw) if default_raw is not None else None

        override = self._namespaces.get("env")
        if override is not None:
            result = override(var_name, default_val)
            if inspect.isawaitable(result):
                result = await result
            return result

        value = env_resolve(None, [var_name], None, None, default_val)
        if value is None and default_raw is None:
            return self._handle_missing(expression, f"Env variable not found: {var_name}")
        return value

    async def _resolve_compute(
        self,
        match: re.Match[str],
        context: Any,
        scope: ComputeScope,
        expression: str,
    ) -> Any:
        full_name = match.group(1)
        default_raw = match.group(3)
        # `fn:NAME.path.to.value` — split the registry name from an optional
        # dotted accessor applied after the function returns.
        if "." in full_name:
            fn_name, accessor = full_name.split(".", 1)
        else:
            fn_name, accessor = full_name, None
        if not self.registry.has(fn_name):
            return self._handle_missing(
                expression,
                f"Compute function not registered: {fn_name}",
                default_raw,
            )
        fn_scope = self.registry.get_scope(fn_name)
        if scope == ComputeScope.STARTUP and fn_scope == ComputeScope.REQUEST:
            # REQUEST functions during STARTUP scope return the literal template string.
            return expression
        result = await self.registry.resolve(fn_name, context, accessor)
        if accessor is not None and isinstance(result, (dict, list)):
            sliced = _lodash_get(result, accessor)
            if sliced is None:
                return self._handle_missing(
                    expression,
                    f"Path not found in compute result: {full_name}",
                    default_raw,
                )
            return sliced
        return result

    def _resolve_template(self, match: re.Match[str], context: Any, expression: str) -> Any:
        path = match.group(1)
        default_raw = match.group(3)
        Security.validate_path(path)
        value = _lodash_get(context, path)
        if value is None:
            return self._handle_missing(
                expression,
                f"Path not found in context: {path}",
                default_raw,
            )
        return value

    def _handle_missing(
        self,
        expression: str,
        message: str,
        default_raw: str | None = None,
    ) -> Any:
        if default_raw is not None:
            return parse_default(default_raw)
        if self.missing_strategy == MissingStrategy.IGNORE:
            return expression
        if self.missing_strategy == MissingStrategy.DEFAULT:
            return None
        raise ComputeFunctionError(
            message,
            ErrorCode.COMPUTE_FUNCTION_NOT_FOUND,
            {"expression": expression},
        )


def create_resolver(
    registry: ComputeRegistry | None = None,
    missing_strategy: MissingStrategy = MissingStrategy.ERROR,
    max_depth: int = 10,
) -> ContextResolver:
    return ContextResolver(
        registry=registry, missing_strategy=missing_strategy, max_depth=max_depth
    )
