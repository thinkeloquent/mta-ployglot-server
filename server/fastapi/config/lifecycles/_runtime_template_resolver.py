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

from runtime_template_resolver import (
    ComputeRegistry,
    ContextResolver,
    MissingStrategy,
    create_resolver,
)

from ._env_resolve import EnvResolver


def make_resolver(registry: ComputeRegistry | None = None) -> ContextResolver:
    # IGNORE so unmatched {{app.X}} / {{request.X}} refs (no context at boot) become
    # literal strings rather than aborting. {{fn:…}} refs resolve via the registry.
    return create_resolver(registry=registry, missing_strategy=MissingStrategy.IGNORE)


@dataclass(frozen=True)
class ResolverHandle:
    env_resolve: EnvResolver
    _resolver: ContextResolver = field(default_factory=make_resolver)

    async def resolve(self, expression: Any, context: dict[str, Any] | None = None) -> Any:
        return await self._resolver.resolve(expression, context or {})

    async def resolve_object(self, obj: Any, context: dict[str, Any] | None = None) -> Any:
        return await self._resolver.resolve_object(obj, context or {})


__all__ = ["ResolverHandle"]
