"""Resolve FigmaClient config from explicit options + env fallbacks."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

from ._errors import FigmaConfigError
from ._proxy import optional_env

DEFAULT_FIGMA_HOST = "https://api.figma.com"


@dataclass
class FigmaConfig:
    host: str
    token: str
    user: str
    proxy: dict[str, Any] | None
    timeout_ms: int
    default_headers: dict[str, str] = field(default_factory=dict)
    retry: dict[str, Any] | bool | None = None
    force_overwrite_retry: bool = False


def resolve_figma_config(
    *,
    token: str | None = None,
    host: str | None = None,
    user: str | None = None,
    proxy: dict[str, Any] | None = None,
    timeout_ms: int = 30_000,
    default_headers: dict[str, str] | None = None,
    retry: dict[str, Any] | bool | None = None,
    force_overwrite_retry: bool = False,
) -> FigmaConfig:
    resolved_host = host or optional_env("FIGMA_HOST", DEFAULT_FIGMA_HOST)
    resolved_token = token or os.environ.get("FIGMA_PASS") or ""
    resolved_user = user if user is not None else optional_env("FIGMA_USER", "")

    if not resolved_token:
        raise FigmaConfigError(
            "FigmaClient requires a token. Pass `token=` or set env FIGMA_PASS."
        )
    if not (resolved_host.startswith("http://") or resolved_host.startswith("https://")):
        raise FigmaConfigError(
            f"Invalid FIGMA_HOST: {resolved_host}. Must start with http(s)://"
        )

    return FigmaConfig(
        host=resolved_host,
        token=resolved_token,
        user=resolved_user,
        proxy=proxy,
        timeout_ms=timeout_ms,
        default_headers=default_headers or {},
        retry=retry,
        force_overwrite_retry=force_overwrite_retry,
    )
