"""ApplierHandle helper — wraps apply_overwrites_from_context as an async callable.

Deviation from plan: upstream Python export is `apply_overwrites_from_context` (snake)
and is async. The handle exposes both an awaitable `__call__` and a sync `apply_sync`
helper for non-async callers (uses `asyncio.run` — must be called from outside an
event loop).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from app_yaml_from_context import apply_overwrites_from_context

from ._runtime_template_resolver import ResolverHandle


@dataclass(frozen=True)
class ApplierHandle:
    resolver: ResolverHandle

    async def __call__(
        self,
        cfg: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await apply_overwrites_from_context(
            cfg,
            resolver=self.resolver._resolver,
            context=context or {},
        )

    def apply_sync(
        self,
        cfg: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return asyncio.run(self(cfg, context))


__all__ = ["ApplierHandle"]
