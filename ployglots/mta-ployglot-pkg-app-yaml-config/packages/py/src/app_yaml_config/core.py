"""AppYamlConfig singleton — twin of packages/mjs/src/core.mjs."""

from __future__ import annotations

import copy
import importlib
from collections.abc import Mapping
from typing import Any, ClassVar

from .errors import ImmutabilityError
from .merge import merge_files, merge_global_into_providers


_IMMUTABLE_MSG = "Configuration is immutable"


class AppYamlConfig:
    _instance: ClassVar["AppYamlConfig | None"] = None

    def __init__(self, logger: Any = None) -> None:
        self._config: dict[str, Any] = {}
        self._original_configs: dict[str, Any] = {}
        self._initial_merged_config: dict[str, Any] | None = None
        self._logger = logger

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    @classmethod
    async def initialize(cls, **options: Any) -> "AppYamlConfig":
        if cls._instance is not None:
            return cls._instance

        loaded = options.get("loaded")
        if loaded is None:
            try:
                loader = importlib.import_module("app_yaml_loader")
            except ImportError as exc:
                raise RuntimeError(
                    "AppYamlConfig.initialize requires either `loaded` "
                    "(Mapping[path, parsed]) or the optional dependency `app_yaml_loader`"
                ) from exc

            if options.get("files"):
                load_files = getattr(loader, "load_files", None) or getattr(loader, "loadFiles")
                loaded = await _maybe_await(load_files(options["files"]))
            elif options.get("configDir") or options.get("config_dir"):
                load_from_dir = getattr(loader, "load_from_config_dir", None) or getattr(
                    loader, "loadFromConfigDir"
                )
                loaded = await _maybe_await(load_from_dir(options))
            else:
                raise ValueError(
                    "AppYamlConfig.initialize needs one of: loaded, files, configDir"
                )

        inst = cls(options.get("logger"))
        for path, parsed in loaded.items():
            inst._original_configs[path] = copy.deepcopy(parsed if parsed is not None else {})

        merged = merge_files(loaded)
        merged = merge_global_into_providers(merged)
        inst._config = merged
        inst._initial_merged_config = copy.deepcopy(merged)

        cls._instance = inst
        return inst

    @classmethod
    def get_instance(cls) -> "AppYamlConfig":
        if cls._instance is None:
            raise RuntimeError("AppYamlConfig not initialized")
        return cls._instance

    @classmethod
    def _reset_for_testing(cls) -> None:
        cls._instance = None

    def restore(self) -> None:
        if self._initial_merged_config is not None:
            self._config = copy.deepcopy(self._initial_merged_config)

    # ------------------------------------------------------------------
    # Read-only surface (F04)
    # ------------------------------------------------------------------
    def get(self, key: str, default: Any = None) -> Any:
        if key not in self._config:
            return default
        v = self._config[key]
        return copy.deepcopy(v) if isinstance(v, (Mapping, list)) else v

    def get_nested(self, keys: list[str], default: Any = None) -> Any:
        cur: Any = self._config
        for k in keys:
            if isinstance(cur, Mapping) and k in cur:
                cur = cur[k]
            else:
                return default
        return copy.deepcopy(cur) if isinstance(cur, (Mapping, list)) else cur

    def get_all(self) -> dict[str, Any]:
        return copy.deepcopy(self._config)

    def get_global_app_config(self) -> dict[str, Any]:
        return copy.deepcopy(self._config.get("global") or {})

    def get_original(self, file: str | None) -> dict[str, Any] | None:
        if not file:
            return None
        v = self._original_configs.get(file)
        return copy.deepcopy(v) if v is not None else None

    def get_original_all(self) -> dict[str, Any]:
        return {k: copy.deepcopy(v) for k, v in self._original_configs.items()}

    # ------------------------------------------------------------------
    # Immutability stubs (F05)
    # ------------------------------------------------------------------
    def set(self, *_args: Any, **_kwargs: Any) -> None:
        raise ImmutabilityError(_IMMUTABLE_MSG)

    def update(self, *_args: Any, **_kwargs: Any) -> None:
        raise ImmutabilityError(_IMMUTABLE_MSG)

    def reset(self) -> None:
        raise ImmutabilityError(_IMMUTABLE_MSG)

    def clear(self) -> None:
        raise ImmutabilityError(_IMMUTABLE_MSG)


async def _maybe_await(value: Any) -> Any:
    """Await `value` if it is a coroutine, else return it as-is.

    Lets the loader twin be either sync or async without forcing one shape.
    """
    import inspect

    if inspect.isawaitable(value):
        return await value
    return value
