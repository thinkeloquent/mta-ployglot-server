"""env-resolve core implementation.

See SPEC.md at the repo root for the canonical algorithm and drift resolutions.
"""

from __future__ import annotations

import os
import re
from typing import Any


def resolve(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: Any,
) -> Any:
    """Resolve a configuration value from arg / env / config / default.

    Tier order (see SPEC.md):
      1. arg                — returned if not None (D1)
      2. env_keys           — first-match-wins; None short-circuits (D7)
      3. config[config_key] — returned if value is not None (D3)
      4. default
    """
    # Tier 1 — direct argument (D1)
    if arg is not None:
        return arg

    # Tier 2 — environment variables (D7: None short-circuits)
    if env_keys is not None:
        keys: list[str] = [env_keys] if isinstance(env_keys, str) else list(env_keys)
        for key in keys:
            if key:
                val = os.getenv(key)
                if val is not None:
                    return val

    # Tier 3 — config-object lookup (D3: value-non-nullish)
    if config is not None and config_key is not None:
        cval = config.get(config_key)
        if cval is not None:
            return cval

    # Tier 4 — default
    return default


TRUTHY_STRINGS: tuple[str, ...] = ("true", "1", "yes", "on")


def resolve_bool(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: bool,
) -> bool:
    """Resolve a value via :func:`resolve` and coerce to bool per SPEC.md §"Boolean coercion".

    Truthy strings are case-insensitive members of :data:`TRUTHY_STRINGS`.
    """
    val = resolve(arg, env_keys, config, config_key, default)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in TRUTHY_STRINGS
    if isinstance(val, (int, float)):
        return val != 0
    return bool(val)


_INT_STRING_RE: re.Pattern[str] = re.compile(r"-?\d+")


def resolve_int(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: int,
) -> int:
    """Resolve a value via :func:`resolve` and coerce to int per SPEC.md.

    See SPEC.md §"Integer coercion (D4, D5)".

    Strict parsing rules:
      - **D4**: decimal-shaped strings (e.g. ``"3.14"``) return ``default``.
        ``int("3.14")`` would raise ``ValueError`` (already caught); the regex gate
        makes the rejection deterministic and aligned with the TypeScript port.
      - **D5**: bool inputs (``True`` / ``False``) return ``default``.
        ``int(True)`` would give ``1``; the explicit ``isinstance(val, bool)`` guard
        rejects before reaching ``int()``.
      - Non-integer numerics (e.g. floats) take the ``isinstance(val, int)`` arm,
        which excludes ``bool`` because of the preceding guard.

    No exception escapes; every parse-failure path returns ``default``.
    """
    val = resolve(arg, env_keys, config, config_key, default)
    if isinstance(val, bool):  # D5: must precede int check
        return default
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        if not _INT_STRING_RE.fullmatch(val):  # D4
            return default
        try:
            return int(val)
        except (ValueError, TypeError):
            return default
    return default


def resolve_float(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: float,
) -> float:
    """Resolve a value via :func:`resolve` and coerce to float per SPEC.md §"Float coercion (D6)".

    Rejects partial-numeric strings (e.g. ``"12abc"``) via ``float()``'s built-in strictness.
    No exception escapes; every parse-failure path returns ``default``.
    """
    val = resolve(arg, env_keys, config, config_key, default)
    if isinstance(val, bool):
        return float(val)  # True → 1.0, False → 0.0 (no D5 analog for floats)
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
    return default
