"""FetchConfigHandle — wraps app_yaml_fetch_config exports for DI.

Deviation from plan: upstream `EndpointConfigSDK(options=None, *, file_path=None)`
takes options metadata, NOT the merged config dict; the singleton store is set via
the module-level `load_config(merged)` instead. The handle therefore exposes the
module-level functions and keeps the SDK around as an empty navigation helper.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app_yaml_fetch_config import (
    EndpointConfigSDK,
    get_endpoint,
    get_fetch_config,
    list_endpoints,
    resolve_intent,
)


@dataclass(frozen=True)
class FetchConfigHandle:
    sdk: EndpointConfigSDK

    def get_fetch_config(
        self,
        intent: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return get_fetch_config(intent, payload or {})

    def list_endpoints(self) -> list[str]:
        return list_endpoints()

    def get_endpoint(self, name: str) -> dict[str, Any] | None:
        return get_endpoint(name)

    def resolve_intent(self, intent: str) -> str:
        return resolve_intent(intent)


__all__ = ["FetchConfigHandle"]
