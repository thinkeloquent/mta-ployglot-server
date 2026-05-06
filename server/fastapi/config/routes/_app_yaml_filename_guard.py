"""Strict basename guard for the dynamic /healthz/app-yaml-file route."""

from __future__ import annotations

import re

_SAFE_BASENAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.\-]*\.(ya?ml)$")


def assert_safe_basename(name: str) -> str:
    if not isinstance(name, str) or not name:
        raise ValueError("filename must be a non-empty string")
    if not _SAFE_BASENAME.match(name):
        raise ValueError(
            f"filename must match {_SAFE_BASENAME.pattern} "
            "(basename only, .yaml/.yml extension required)"
        )
    return name


__all__ = ["assert_safe_basename"]
