"""Bind FetchConfigHandle to app.state — terminal lifecycle in the chain."""

from __future__ import annotations

import logging

from app_yaml_fetch_config import EndpointConfigSDK, list_endpoints, load_config

from ._app_yaml_fetch_config import FetchConfigHandle

log = logging.getLogger("fastapi_server.app_yaml_fetch_config")


def on_init(app, _config) -> None:
    app.state.app_yaml_fetch_config = None


async def on_startup(app, _config) -> None:
    cfg_handle = getattr(app.state, "app_yaml_config", None)
    applier = getattr(app.state, "app_yaml_applier", None)
    if cfg_handle is None or applier is None:
        raise RuntimeError(
            "app_yaml_config or app_yaml_applier missing — confirm 27 + 28 run before 29"
        )
    merged = await applier(cfg_handle.raw)
    load_config(merged)
    sdk = EndpointConfigSDK()
    app.state.app_yaml_fetch_config = FetchConfigHandle(sdk=sdk)
    log.info("app_yaml_fetch_config initialized (endpoints=%d)", len(list_endpoints()))


async def on_shutdown(app, _config) -> None:
    app.state.app_yaml_fetch_config = None
