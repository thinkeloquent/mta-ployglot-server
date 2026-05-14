"""Disk-IO indirection so tests can monkey-patch `read_text`."""

from __future__ import annotations

from pathlib import Path


def read_text(abs_path: str) -> str:
    return Path(abs_path).read_text(encoding="utf-8")
