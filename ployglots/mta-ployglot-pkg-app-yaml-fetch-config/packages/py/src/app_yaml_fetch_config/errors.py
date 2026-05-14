"""Custom error types — twin of packages/mjs/src/errors.mjs."""
from __future__ import annotations


class ConfigError(Exception):
    def __init__(
        self,
        message: str,
        service_id: str | None = None,
        available: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.service_id = service_id
        self.available = list(available) if available else []

    @property
    def serviceId(self) -> str | None:
        return self.service_id
