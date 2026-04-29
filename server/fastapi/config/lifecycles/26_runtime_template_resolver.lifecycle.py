"""Construct a ResolverHandle on app.state for Depends() injection."""

from __future__ import annotations

import logging

from ._runtime_template_resolver import ResolverHandle, make_resolver

log = logging.getLogger("fastapi_server.runtime_template_resolver")


def on_init(app, _config) -> None:
    app.state.runtime_template_resolver = None


async def on_startup(app, _config) -> None:
    env_resolve = getattr(app.state, "env_resolve", None)
    if env_resolve is None:
        raise RuntimeError(
            "env_resolve missing — confirm 15_env_resolve.lifecycle.py runs before 26_runtime_template_resolver"
        )
    registry = getattr(app.state, "compute_registry", None)
    if registry is None:
        raise RuntimeError(
            "compute_registry missing — confirm 24_compute_functions.lifecycle.py runs before 26"
        )
    app.state.runtime_template_resolver = ResolverHandle(
        env_resolve=env_resolve,
        _resolver=make_resolver(registry=registry),
    )
    log.info("runtime_template_resolver initialized (registry has %d fns)", len(getattr(app.state, "compute_registry_ledger", {}).get("registered", [])))


async def on_shutdown(app, _config) -> None:
    app.state.runtime_template_resolver = None
