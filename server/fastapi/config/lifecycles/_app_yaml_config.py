"""ConfigHandle helper — wraps AppYamlConfigSDK as a Depends()-injectable object.

Deviation from plan: upstream `AppYamlConfigSDK(config)` requires an `AppYamlConfig`
instance (not a loaded dict). The `raw` property therefore proxies through
`sdk.get_all()` rather than the no-longer-present `sdk.to_dict()` / `sdk._loaded`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app_yaml_config import AppYamlConfigSDK


@dataclass(frozen=True)
class ConfigHandle:
    sdk: AppYamlConfigSDK

    def list_providers(self) -> list[str]:
        return self.sdk.list_providers()

    def list_services(self) -> list[str]:
        return self.sdk.list_services()

    def list_storages(self) -> list[str]:
        return self.sdk.list_storages()

    def get(self, dot_path: str, default: Any = None) -> Any:
        return self.sdk.get(dot_path, default)

    @property
    def raw(self) -> dict[str, Any]:
        return self.sdk.get_all()


__all__ = ["ConfigHandle"]
