"""Pure merge functions — twin of packages/mjs/src/merge.mjs."""

from __future__ import annotations

import copy
from collections.abc import Mapping
from typing import Any


def _is_dict_like(v: Any) -> bool:
    return isinstance(v, Mapping)


def deep_merge(base: Mapping[str, Any], override: Mapping[str, Any]) -> dict[str, Any]:
    """Deep-merge `override` onto `base`. Arrays replace, dicts recurse, primitives replace."""
    result: dict[str, Any] = copy.deepcopy(dict(base))
    for key, value in override.items():
        a = result.get(key)
        if (
            key in result
            and _is_dict_like(a)
            and not isinstance(a, list)
            and _is_dict_like(value)
            and not isinstance(value, list)
        ):
            result[key] = deep_merge(a, value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def merge_files(loaded: Mapping[str, Any] | None) -> dict[str, Any]:
    """Fold an ordered mapping of (path -> parsed) into one object via deep_merge.

    Iteration order = file priority. Empty input -> {}.
    """
    merged: dict[str, Any] = {}
    if loaded is None:
        return merged
    for parsed in loaded.values():
        merged = deep_merge(merged, parsed if parsed is not None else {})
    return merged


def merge_global_into_providers(merged: Mapping[str, Any] | None) -> dict[str, Any]:
    """Propagate `global` defaults into each `providers.<name>` entry."""
    result: dict[str, Any] = copy.deepcopy(dict(merged or {}))
    g = result.get("global")
    ps = result.get("providers")
    if not _is_dict_like(g) or len(g) == 0:
        return result
    if not _is_dict_like(ps) or len(ps) == 0:
        return result
    for name, p in ps.items():
        if _is_dict_like(p):
            result["providers"][name] = deep_merge(g, p)
    return result
