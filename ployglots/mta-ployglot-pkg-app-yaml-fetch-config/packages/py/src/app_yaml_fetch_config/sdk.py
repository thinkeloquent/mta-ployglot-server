"""EndpointConfigSDK class wrapper — twin of packages/mjs/src/sdk.mjs."""
from __future__ import annotations

from typing import Any

from .config import (
    get_config,
    get_endpoint,
    get_fetch_config,
    list_endpoints,
    load_config as _module_load_config,
    load_config_from_file,
    resolve_intent as _module_resolve_intent,
)


class EndpointConfigSDK:
    def __init__(self, options: dict | None = None, *, file_path: str | None = None):
        if options is None:
            options = {}
        # Accept both `filePath` (parity with mjs) and `file_path` (snake-case kwarg).
        self._file_path = options.get("filePath") or options.get("file_path") or file_path

    def load_config(self, obj: dict) -> dict:
        return _module_load_config(obj)

    def load_from_file(self, file_path: str) -> dict:
        self._file_path = file_path
        return load_config_from_file(file_path)

    def refresh_config(self) -> dict:
        if not self._file_path:
            raise RuntimeError(
                "Cannot refresh: no file_path. Use load_from_file() first."
            )
        return load_config_from_file(self._file_path)

    def get_by_key(self, key: str) -> dict | None:
        return get_endpoint(key)

    def get_all(self) -> list[dict]:
        return [ep for ep in (get_endpoint(k) for k in list_endpoints()) if ep]

    def get_by_name(self, name: str) -> dict | None:
        for ep in self.get_all():
            if ep["name"] == name:
                return ep
        return None

    def get_by_tag(self, tag: str) -> list[dict]:
        return [ep for ep in self.get_all() if tag in ep["tags"]]

    def list_keys(self) -> list[str]:
        return list_endpoints()

    def properties(self, dot_path: str, default_value: Any = None) -> Any:
        cfg = get_config()
        cur: Any = cfg
        for p in dot_path.split("."):
            if not isinstance(cur, dict):
                return default_value
            if p not in cur:
                return default_value
            cur = cur[p]
        return cur if cur is not None else default_value

    def resolve_intent(self, intent: str) -> dict:
        key = _module_resolve_intent(intent)
        return {"key": key, "endpoint": get_endpoint(key)}

    def get_fetch_config(
        self,
        service_id: str,
        payload: Any,
        custom_headers: dict | None = None,
    ) -> dict:
        return get_fetch_config(service_id, payload, custom_headers)

    # CamelCase parity aliases — mirror the mjs surface so consumers can use either style.
    loadConfig = load_config
    loadFromFile = load_from_file
    refreshConfig = refresh_config
    getByKey = get_by_key
    getAll = get_all
    getByName = get_by_name
    getByTag = get_by_tag
    listKeys = list_keys
    resolveIntent = resolve_intent
    getFetchConfig = get_fetch_config


def create_endpoint_config_sdk(options: dict | None = None) -> EndpointConfigSDK:
    return EndpointConfigSDK(options or {})


createEndpointConfigSDK = create_endpoint_config_sdk
