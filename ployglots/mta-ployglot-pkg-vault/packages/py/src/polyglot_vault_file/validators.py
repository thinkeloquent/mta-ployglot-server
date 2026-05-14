"""Validators — holds EnvKeyNotFoundError."""
from __future__ import annotations


class EnvKeyNotFoundError(Exception):
    """Raised by EnvStore.get_or_throw when a required key is missing."""

    def __init__(self, key: str) -> None:
        self.key = key
        super().__init__(f"Environment variable '{key}' not found")
