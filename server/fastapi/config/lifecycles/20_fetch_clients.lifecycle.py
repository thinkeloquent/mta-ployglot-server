"""Construct + tear down the FetchClientRegistry on app lifespan."""

from __future__ import annotations

import logging

from ._fetch_factories import FACTORIES
from ._fetch_registry import FetchClientRegistry

log = logging.getLogger("fastapi_server.fetch_clients")


def on_init(app, _config) -> None:
    app.state.fetch_clients = None


async def on_startup(app, _config) -> None:
    app.state.fetch_clients = FetchClientRegistry(FACTORIES)
    log.info(
        "fetch_clients registry initialized: providers=%s",
        ",".join(app.state.fetch_clients.providers),
    )


async def on_shutdown(app, _config) -> None:
    registry = getattr(app.state, "fetch_clients", None)
    if registry is None:
        return
    await registry.aclose()
    log.info("fetch_clients registry closed")
