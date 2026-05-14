"""Test helpers shared across the Python test suite."""

from __future__ import annotations

from typing import Any


def assert_eq(actual: Any, expected: Any, *, label: str = "") -> None:
    """Strict equality that distinguishes bool from int.

    Python's ``1 == True`` is ``True`` because ``bool`` is a subclass of ``int``;
    this helper uses ``is`` for booleans so the parity contract catches a port
    that returns ``1`` where ``True`` was expected (and vice versa).
    """
    if isinstance(expected, bool):
        assert actual is expected, (
            f"{label}: got {actual!r} (type {type(actual).__name__}), expected {expected!r}"
        )
    else:
        assert actual == expected, f"{label}: got {actual!r}, expected {expected!r}"
