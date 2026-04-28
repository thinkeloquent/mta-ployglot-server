"""Initialize AppYamlConfig singleton + bind ConfigHandle to app.state."""

from __future__ import annotations

import logging

from app_yaml_config import AppYamlConfig, AppYamlConfigSDK

from ._app_yaml_config import ConfigHandle

log = logging.getLogger("fastapi_server.app_yaml_config")


def on_init(app, _config) -> None:
    app.state.app_yaml_config = None


async def on_startup(app, _config) -> None:
    loader = getattr(app.state, "app_yaml_loader", None)
    if loader is None:
        raise RuntimeError(
            "app_yaml_loader missing — confirm 25_app_yaml_loader.lifecycle.py runs before 27"
        )
    loaded = loader.load_from_config_dir(missing="skip")
    config = await AppYamlConfig.initialize(loaded=loaded)
    sdk = AppYamlConfigSDK(config)
    app.state.app_yaml_config = ConfigHandle(sdk=sdk)
    log.info("app_yaml_config initialized (providers=%d)", len(sdk.list_providers()))


async def on_shutdown(app, _config) -> None:
    app.state.app_yaml_config = None
