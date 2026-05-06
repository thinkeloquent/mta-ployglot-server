"""ProviderConfigEcho — slice + resolve + mask provider config for diagnostics.

Used by /healthz/integrations/* routes to add a `config_used` field
showing the post-pipeline provider slice with templates resolved and
credential keys masked. See
AI-Agent-Plans/19/integration-config-echo-20260504-b3a1f29c/stories/01/_provider_config_echo.contract.md
for the canonical spec.

Deviation from plan (location): the plan placed this helper at
`config/lifecycles/_provider_config_echo.py`, but the route addon's
synthetic-package loader (`polyglot_routes`) does not share `__path__`
with the lifecycle loader (`polyglot_lifecycle`), so route files cannot
do `from ..lifecycles._provider_config_echo import build_echo`. The
helper lives here in `config/routes/` so route files can resolve it
via the same `from ._<name>` pattern that `_di.py` uses for sibling
helpers. The fastify twin keeps the file in `config/lifecycles/`
because Node ESM uses real filesystem paths and the equivalent
constraint does not apply.

Deviation from plan (trigger): the contract requires a `trigger`
parameter mapping to `ComputeScope.STARTUP` / `REQUEST`. The default
path (`trigger="OnRequest"`) calls `resolver.resolve_object(slice, ctx)`
— the existing `ResolverHandle.resolve_object` thin wrapper, which
defaults to REQUEST scope inside the engine. For `OnStart` and `Both`
we reach through the handle to the underlying `ContextResolver`
(`resolver._resolver.resolve_object(...)`) to pass an explicit scope.
This keeps slot 26 as the single owner of `create_resolver()` while
letting diagnostic surfaces select a scope at call-time.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from fastapi import Request
from runtime_template_resolver import ComputeScope

if TYPE_CHECKING:
    from ..lifecycles._runtime_template_resolver import ResolverHandle

# Verbatim from contract doc. Case-insensitive.
CREDENTIAL_KEY_RE = re.compile(
    r"^(.*_)?(api_key|api_token|access_key|secret|password|token|client_secret)$",
    re.IGNORECASE,
)

# Verbatim from contract doc. Case-insensitive comparison required.
SENSITIVE_HEADER_NAMES = frozenset({
    "authorization",
    "x-api-key",
    "x-auth-token",
    "cookie",
    "set-cookie",
})

MASKED_LITERAL = "***"

_VALID_TRIGGERS = ("OnStart", "OnRequest", "Both")


def _build_request_context(request: Request, cfg: dict[str, Any]) -> dict[str, Any]:
    return {
        "app": cfg.get("app") if isinstance(cfg, dict) else None,
        "request": {
            "headers": {k.lower(): v for k, v in request.headers.items()},
            "method": request.method,
            "path": request.url.path,
        },
    }


async def _resolve_with_trigger(
    resolver: "ResolverHandle",
    slice_: Any,
    ctx: dict[str, Any],
    trigger: str,
) -> Any:
    inner = getattr(resolver, "_resolver", None)
    if trigger == "OnRequest":
        if inner is not None:
            return await inner.resolve_object(slice_, ctx, ComputeScope.REQUEST)
        return await resolver.resolve_object(slice_, ctx)
    if inner is None:
        return await resolver.resolve_object(slice_, ctx)
    if trigger == "OnStart":
        return await inner.resolve_object(slice_, ctx, ComputeScope.STARTUP)
    # "Both": STARTUP first, then REQUEST over the partially-resolved tree.
    startup_pass = await inner.resolve_object(slice_, ctx, ComputeScope.STARTUP)
    return await inner.resolve_object(startup_pass, ctx, ComputeScope.REQUEST)


async def build_echo(
    provider: str,
    request: Request,
    cfg: dict[str, Any],
    resolver: "ResolverHandle",
    *,
    trigger: str = "OnRequest",
) -> dict[str, Any] | None:
    """Return the resolved-and-masked provider slice. None if missing."""
    if trigger not in _VALID_TRIGGERS:
        raise ValueError(
            f"Invalid trigger {trigger!r}; expected one of {_VALID_TRIGGERS}"
        )
    if not isinstance(cfg, dict):
        return None
    slice_ = cfg.get("providers", {}).get(provider)
    if not isinstance(slice_, dict):
        return None
    ctx = _build_request_context(request, cfg)
    resolved = await _resolve_with_trigger(resolver, slice_, ctx, trigger)
    return _mask(resolved)


def _mask(node: Any, parent_key: str | None = None) -> Any:
    if isinstance(node, dict):
        is_headers = parent_key is not None and parent_key.lower() == "headers"
        out: dict[str, Any] = {}
        for k, v in node.items():
            if isinstance(k, str) and CREDENTIAL_KEY_RE.match(k):
                out[k] = MASKED_LITERAL
            elif is_headers and isinstance(k, str) and k.lower() in SENSITIVE_HEADER_NAMES:
                out[k] = MASKED_LITERAL
            else:
                out[k] = _mask(v, k)
        return out
    if isinstance(node, list):
        return [_mask(v, parent_key) for v in node]
    return node


__all__ = ["build_echo", "CREDENTIAL_KEY_RE", "SENSITIVE_HEADER_NAMES", "MASKED_LITERAL"]
