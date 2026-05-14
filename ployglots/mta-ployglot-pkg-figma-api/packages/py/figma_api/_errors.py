"""Typed error hierarchy for polyglot-figma-api.

All errors extend :class:`FigmaError`. Subclasses encode *what kind of
failure* occurred without leaking transport details.
"""

from __future__ import annotations

from dataclasses import dataclass


class FigmaError(Exception):
    """Base class for every polyglot-figma-api error."""


class FigmaConfigError(FigmaError):
    """Raised when config (token, host, …) is missing or invalid."""


class FigmaAuthError(FigmaError):
    """Raised on 401 / 403 responses."""

    def __init__(self, message: str, status: int = 401) -> None:
        super().__init__(message)
        self.status = status


class FigmaNotFoundError(FigmaError):
    """Raised on 404 responses."""

    status = 404


class FigmaRateLimitError(FigmaError):
    """Raised on 429 responses; carries `retry_after_seconds` when parseable."""

    status = 429

    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class FigmaServerError(FigmaError):
    """Raised on 5xx responses."""

    def __init__(self, message: str, status: int) -> None:
        super().__init__(message)
        self.status = status


class FigmaTransportError(FigmaError):
    """Raised for network-level failures (DNS, TCP, TLS, timeouts)."""


@dataclass
class FigmaErrorContext:
    method: str
    url: str
    status: int
    body: str = ""
    retry_after: str | None = None


def map_http_error(ctx: FigmaErrorContext) -> FigmaError:
    """Map an HTTP response into the right :class:`FigmaError` subclass."""
    snippet = f" — {ctx.body[:200]}" if ctx.body else ""
    prefix = f"{ctx.method} {ctx.url} → {ctx.status}"

    if ctx.status in (401, 403):
        return FigmaAuthError(f"{prefix}{snippet}", status=ctx.status)
    if ctx.status == 404:
        return FigmaNotFoundError(f"{prefix}{snippet}")
    if ctx.status == 429:
        retry_after: int | None = None
        if ctx.retry_after:
            try:
                retry_after = int(ctx.retry_after)
            except ValueError:
                retry_after = None
        return FigmaRateLimitError(f"{prefix}{snippet}", retry_after_seconds=retry_after)
    if ctx.status >= 500:
        return FigmaServerError(f"{prefix}{snippet}", status=ctx.status)
    return FigmaError(f"{prefix}{snippet}")
