"""Lazily-imported default resolver from runtime_template_resolver."""

from __future__ import annotations

from typing import Any

_ENGINE_PKG = "runtime_template_resolver"
_cached: Any = None


def default_resolver() -> Any:
    global _cached
    if _cached is not None:
        return _cached
    try:
        import importlib

        mod = importlib.import_module(_ENGINE_PKG)
    except ImportError as exc:
        raise RuntimeError(
            f"applier requires the '{_ENGINE_PKG}' package to be installed "
            f"when no resolver is injected. Install it or pass resolver= explicitly. "
            f"(cause: {exc})"
        ) from exc
    if not hasattr(mod, "create_resolver"):
        raise RuntimeError(
            f"'{_ENGINE_PKG}' did not expose create_resolver(); pass resolver= explicitly."
        )
    _cached = mod.create_resolver()
    return _cached
