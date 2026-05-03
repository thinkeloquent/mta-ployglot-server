"""Initialize AppYamlConfig singleton + bind ConfigHandle to app.state."""

from __future__ import annotations

import logging
from collections import OrderedDict
from pathlib import Path

from app_yaml_config import AppYamlConfig, AppYamlConfigSDK

from ._app_yaml_config import ConfigHandle

log = logging.getLogger("fastapi_server.app_yaml_config")

EXTRA_CONFIG_FILES = ("database_schema.yaml", "llm_rag.yml", "vite.yaml")


def on_init(app, _config) -> None:
    app.state.app_yaml_config = None


async def on_startup(app, _config) -> None:
    loader = getattr(app.state, "app_yaml_loader", None)
    if loader is None:
        raise RuntimeError(
            "app_yaml_loader missing — confirm 25_app_yaml_loader.lifecycle.py runs before 27"
        )
    loaded_default = loader.load_from_config_dir(missing="skip")
    extra_paths = [str(Path(loader.config_dir) / f) for f in EXTRA_CONFIG_FILES]
    loaded_extra = loader.load_files(extra_paths, missing="skip")
    loaded: OrderedDict = OrderedDict()
    for k, v in loaded_default.items():
        loaded[k] = v
    for k, v in loaded_extra.items():
        loaded[k] = v
    config = await AppYamlConfig.initialize(loaded=loaded)
    sdk = AppYamlConfigSDK(config)
    app.state.app_yaml_config = ConfigHandle(sdk=sdk)
    log.info(
        "app_yaml_config initialized (providers=%d, default=%d, extra=%d)",
        len(sdk.list_providers()),
        len(loaded_default),
        len(loaded_extra),
    )


async def on_shutdown(app, _config) -> None:
    app.state.app_yaml_config = None
