"""AppYamlConfigSDK — twin of packages/mjs/src/sdk.mjs."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .core import AppYamlConfig


class AppYamlConfigSDK:
    def __init__(self, config: AppYamlConfig) -> None:
        self._config = config

    @classmethod
    async def from_directory(cls, config_dir: str) -> "AppYamlConfigSDK":
        await AppYamlConfig.initialize(configDir=config_dir)
        return cls(AppYamlConfig.get_instance())

    def get_all(self) -> dict[str, Any]:
        return self._config.get_all()

    def list_providers(self) -> list[str]:
        return list((self._config.get("providers") or {}).keys())

    def list_services(self) -> list[str]:
        return list((self._config.get("services") or {}).keys())

    def list_storages(self) -> list[str]:
        return list((self._config.get("storage") or {}).keys())

    def get(self, path: str, default: Any = None) -> Any:
        if not path or not isinstance(path, str):
            return default
        cur: Any = self._config.get_all()
        for part in path.split("."):
            if isinstance(cur, Mapping) and part in cur:
                cur = cur[part]
            else:
                return default
        return cur if cur is not None else default
