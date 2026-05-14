"""Per-language tests for resolve_bool/resolve_int/resolve_float."""

from __future__ import annotations

import pytest

from env_resolve import TRUTHY_STRINGS, resolve_bool, resolve_float, resolve_int


@pytest.mark.parametrize("val", ["true", "TRUE", "1", "yes", "Yes", "on", "ON"])
def test_resolve_bool_truthy_strings(val: str) -> None:
    assert resolve_bool(val, None, None, None, False) is True


@pytest.mark.parametrize("val", ["false", "0", "no", "off", ""])
def test_resolve_bool_falsy_strings(val: str) -> None:
    assert resolve_bool(val, None, None, None, True) is False


def test_resolve_bool_zero_number() -> None:
    assert resolve_bool(0, None, None, None, True) is False


def test_resolve_bool_nonzero_number() -> None:
    assert resolve_bool(42, None, None, None, False) is True


def test_resolve_int_clean_string() -> None:
    assert resolve_int("42", None, None, None, 0) == 42


def test_resolve_int_decimal_string_d4() -> None:
    # D4: "3.14" rejected.
    assert resolve_int("3.14", None, None, None, 0) == 0


def test_resolve_int_bool_arg_d5() -> None:
    # D5: True rejected (Python int(True)=1 explicitly guarded).
    assert resolve_int(True, None, None, None, 0) == 0
    assert resolve_int(False, None, None, None, 99) == 99


def test_resolve_int_clean_number() -> None:
    assert resolve_int(7, None, None, None, 0) == 7


def test_resolve_int_float_value_rejected() -> None:
    # 1.5 is not isinstance(int); rejected.
    assert resolve_int(1.5, None, None, None, 0) == 0


def test_resolve_float_clean_string() -> None:
    assert resolve_float("3.14", None, None, None, 0.0) == 3.14


def test_resolve_float_scientific_notation() -> None:
    assert resolve_float("1e3", None, None, None, 0.0) == 1000.0


def test_resolve_float_partial_numeric_d6() -> None:
    # D6: "12abc" rejected.
    assert resolve_float("12abc", None, None, None, 0.0) == 0.0


def test_resolve_float_int_value() -> None:
    assert resolve_float(42, None, None, None, 0.0) == 42.0


def test_truthy_strings_constant() -> None:
    assert TRUTHY_STRINGS == ("true", "1", "yes", "on")
