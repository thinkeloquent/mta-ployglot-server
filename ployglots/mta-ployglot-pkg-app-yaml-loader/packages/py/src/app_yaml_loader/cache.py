"""Module-level path-keyed cache. Process-local; cross-process invalidation is out of scope."""

from __future__ import annotations

import copy
from typing import Any

_store: dict[str, Any] = {}


class _Miss:
    __slots__ = ()


_MISS = _Miss()


def cache_get(abs_path: str):
    """Return a deep copy of the cached value or the `_MISS` sentinel."""
    if abs_path in _store:
        return copy.deepcopy(_store[abs_path])
    return _MISS


def cache_set(abs_path: str, value: Any) -> None:
    _store[abs_path] = copy.deepcopy(value)


def clear_cache(abs_path: str | None = None) -> int:
    if abs_path is None:
        n = len(_store)
        _store.clear()
        return n
    return 1 if _store.pop(abs_path, None) is not None else 0


def is_miss(value: Any) -> bool:
    return value is _MISS


def _cache_size() -> int:
    """Test-only — underlying store size without cloning."""
    return len(_store)
