"""deepMergeWithNullReplace — null in override deletes the key."""

from __future__ import annotations

import copy
from typing import Any


def _is_plain_dict(v: Any) -> bool:
    return isinstance(v, dict)


def deep_merge_with_null_replace(base: Any, override: Any) -> dict[str, Any]:
    """Merge `override` into `base`. `None` in override deletes the key.

    - `None` value: delete key from result.
    - dict + dict: recursively merge.
    - lists / scalars / other: override replaces.
    - Inputs are not mutated; returns a new dict.
    """
    result: dict[str, Any] = copy.deepcopy(base) if _is_plain_dict(base) else {}
    if not _is_plain_dict(override):
        return result
    for key, value in override.items():
        if value is None:
            result.pop(key, None)
            continue
        if _is_plain_dict(value) and _is_plain_dict(result.get(key)):
            result[key] = deep_merge_with_null_replace(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result
