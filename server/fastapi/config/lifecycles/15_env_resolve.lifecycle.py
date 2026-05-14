"""Construct an EnvResolver on app.state for Depends() injection.

Pair with `routes/_di.get_env_resolve` to inject into routes::

    from fastapi import Depends
    from .._di import get_env_resolve
    from ..lifecycles._env_resolve import EnvResolver

    @router.get("/...")
    async def handler(resolver: EnvResolver = Depends(get_env_resolve)):
        port = resolver.resolve_int(None, "PORT", "port", 5200)
"""

from __future__ import annotations

import logging

from ._env_resolve import EnvResolver

log = logging.getLogger("fastapi_server.env_resolve")


def on_init(app, _config) -> None:
    app.state.env_resolve = None


async def on_startup(app, _config) -> None:
    app.state.env_resolve = EnvResolver(config=None)
    log.info("env_resolve initialized")


async def on_shutdown(app, _config) -> None:
    app.state.env_resolve = None
