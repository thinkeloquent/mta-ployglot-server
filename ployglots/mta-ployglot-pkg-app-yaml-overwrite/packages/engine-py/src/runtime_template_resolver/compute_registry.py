"""ComputeRegistry — register/resolve named compute functions with STARTUP cache."""

from __future__ import annotations

import asyncio
import inspect
import re
from typing import Any, Awaitable, Callable

from .errors import ComputeFunctionError, ErrorCode
from .options import ComputeScope

_NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

ComputeFn = Callable[..., Any] | Callable[..., Awaitable[Any]]


class ComputeRegistry:
    def __init__(self) -> None:
        self._fns: dict[str, dict[str, Any]] = {}
        self._cache: dict[str, Any] = {}

    def validate_name(self, name: str) -> None:
        if not isinstance(name, str) or not _NAME_PATTERN.match(name):
            raise ValueError(f"Invalid function name: {name}")

    def register(
        self,
        name: str,
        fn: ComputeFn,
        scope: ComputeScope = ComputeScope.REQUEST,
    ) -> None:
        self.validate_name(name)
        if not callable(fn):
            raise ValueError(f"Compute function must be callable: {name}")
        self._fns[name] = {"fn": fn, "scope": scope}

    def unregister(self, name: str) -> bool:
        for key in list(self._cache.keys()):
            if key.startswith(f"{name}:"):
                self._cache.pop(key, None)
        return self._fns.pop(name, None) is not None

    def has(self, name: str) -> bool:
        return name in self._fns

    def list(self) -> list[str]:
        return list(self._fns.keys())

    def get_scope(self, name: str) -> ComputeScope | None:
        entry = self._fns.get(name)
        return entry["scope"] if entry else None

    def clear(self) -> None:
        self._fns.clear()
        self._cache.clear()

    def clear_cache(self) -> None:
        self._cache.clear()

    async def resolve(
        self,
        name: str,
        context: Any,
        property_path: str | None = None,
    ) -> Any:
        entry = self._fns.get(name)
        if entry is None:
            raise ComputeFunctionError(
                f"Compute function not found: {name}",
                ErrorCode.COMPUTE_FUNCTION_NOT_FOUND,
                {"name": name},
            )
        cache_key = f"{name}:{property_path or ''}"
        if entry["scope"] == ComputeScope.STARTUP and cache_key in self._cache:
            return self._cache[cache_key]
        try:
            result = entry["fn"](context, property_path)
            if inspect.isawaitable(result):
                result = await result
        except Exception as exc:  # noqa: BLE001
            raise ComputeFunctionError(
                f"Compute function failed: {name}",
                ErrorCode.COMPUTE_FUNCTION_FAILED,
                {"name": name, "original_error": str(exc)},
            ) from exc
        if entry["scope"] == ComputeScope.STARTUP:
            self._cache[cache_key] = result
        return result


# Convenience: synchronous wrapper that drives the async resolve to completion.
def resolve_sync(registry: ComputeRegistry, name: str, context: Any, property_path: str | None = None) -> Any:
    return asyncio.get_event_loop().run_until_complete(
        registry.resolve(name, context, property_path)
    )
