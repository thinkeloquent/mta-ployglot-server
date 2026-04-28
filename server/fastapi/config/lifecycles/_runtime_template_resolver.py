"""ResolverHandle helper — wraps runtime_template_resolver as a Depends()-injectable object.

The numeric-prefixed lifecycle file `26_runtime_template_resolver.lifecycle.py`
is loaded dynamically by path, so the importable class lives here.

Deviation from plan: upstream `create_resolver(registry, missing_strategy, max_depth)`
does NOT take `env_resolve` — that dep is wired internally inside the engine via
`from env_resolve import resolve as env_resolve`. The handle keeps a reference to
the EnvResolver only for symmetry with the mjs decorator chain.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from runtime_template_resolver import ContextResolver, create_resolver

from ._env_resolve import EnvResolver


@dataclass(frozen=True)
class ResolverHandle:
    env_resolve: EnvResolver
    _resolver: ContextResolver = field(default_factory=create_resolver)

    async def resolve(self, expression: Any, context: dict[str, Any] | None = None) -> Any:
        return await self._resolver.resolve(expression, context or {})

    async def resolve_object(self, obj: Any, context: dict[str, Any] | None = None) -> Any:
        return await self._resolver.resolve_object(obj, context or {})


__all__ = ["ResolverHandle"]
