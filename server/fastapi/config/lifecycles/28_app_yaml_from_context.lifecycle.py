"""Bind ApplierHandle to app.state for Depends() injection."""

from __future__ import annotations

import logging

from ._app_yaml_from_context import ApplierHandle

log = logging.getLogger("fastapi_server.app_yaml_applier")


def on_init(app, _config) -> None:
    app.state.app_yaml_applier = None


async def on_startup(app, _config) -> None:
    resolver = getattr(app.state, "runtime_template_resolver", None)
    if resolver is None:
        raise RuntimeError(
            "runtime_template_resolver missing — confirm 26 runs before 28"
        )
    app.state.app_yaml_applier = ApplierHandle(resolver=resolver)
    log.info("app_yaml_applier initialized")


async def on_shutdown(app, _config) -> None:
    app.state.app_yaml_applier = None
