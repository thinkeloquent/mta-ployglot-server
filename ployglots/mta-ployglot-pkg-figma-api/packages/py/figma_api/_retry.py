"""Figma-sensible retry defaults + user override with a
``force_overwrite`` feature flag.

The underlying ``polyglot-fetch-http-client`` ``AsyncClient`` ships a
retry loop — this module just hands it a config pre-tuned for Figma.

Consumer contract mirrors the ts twin::

    # 1. Default — Figma presets take effect.
    FigmaClient(token=...)

    # 2. Disable inner retry.
    FigmaClient(token=..., retry=False)

    # 3. Tweak selectively (merges on top of Figma defaults).
    FigmaClient(token=..., retry={"max_attempts": 5})

    # 4. force_overwrite = replace defaults verbatim.
    FigmaClient(
        token=...,
        retry={"max_attempts": 1, "retry_on_status": frozenset({503})},
        force_overwrite_retry=True,
    )
"""

from __future__ import annotations

from typing import Any

from fetch_http_client import RetryConfig

# Figma's typical rate-limit window is 1s; 429 + 5xx are retried.
FIGMA_DEFAULT_RETRY: dict[str, Any] = {
    "max_attempts": 3,
    "base_delay": 1.0,
    "max_delay": 30.0,
    "multiplier": 2.0,
    "retry_on_status": frozenset({429, 500, 502, 503, 504}),
}


def build_figma_retry_config(
    input_value: dict[str, Any] | bool | None,
    *,
    force_overwrite: bool = False,
) -> RetryConfig | None:
    """Compile a user retry input into a fetch-http-client ``RetryConfig``.

    Returns ``None`` when retry should be disabled (input is ``False``
    or ``None``). Otherwise returns a populated ``RetryConfig``, merged
    from Figma defaults unless ``force_overwrite`` is true.
    """
    # Explicit disable.
    if input_value is False or input_value is None:
        return None

    # No-input shortcut handled by caller passing {}.
    if input_value is True:
        return RetryConfig(**FIGMA_DEFAULT_RETRY)

    if not isinstance(input_value, dict):
        raise TypeError(
            f"retry must be dict, False, or None — got {type(input_value).__name__}"
        )

    if force_overwrite:
        return RetryConfig(**input_value)

    merged: dict[str, Any] = {**FIGMA_DEFAULT_RETRY, **input_value}
    # Preserve frozen sets — dict spread keeps the user's if they passed one.
    return RetryConfig(**merged)
