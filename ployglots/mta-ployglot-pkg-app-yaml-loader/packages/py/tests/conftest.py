"""Shared pytest helpers + path constants."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PARITY_DIR = REPO_ROOT / "parity"
