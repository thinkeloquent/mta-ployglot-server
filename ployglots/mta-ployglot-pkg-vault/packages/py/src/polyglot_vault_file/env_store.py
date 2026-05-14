"""EnvStore singleton — sync on_startup, vault-wins get, get_or_throw."""
from __future__ import annotations

import os
from typing import ClassVar, Dict, Optional

from .domain import LoadResult
from .logger import IVaultFileLogger, Logger
from .validators import EnvKeyNotFoundError


class EnvStore:
    _instance: ClassVar[Optional["EnvStore"]] = None

    def __init__(self) -> None:
        self._store: Dict[str, str] = {}
        self._initialized: bool = False
        self._total_vars_loaded: int = 0
        self._logger: IVaultFileLogger = Logger.create("polyglot_vault_file", "env_store")

    @classmethod
    def get_instance(cls) -> "EnvStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def _get_total_vars_loaded(cls) -> int:
        """Internal accessor for VaultFileSDK.describe_config / diagnose_env_store."""
        return cls.get_instance()._total_vars_loaded

    @classmethod
    def _reset_for_tests(cls) -> None:
        """Test-only hook — resets the singleton so tests start from a clean store."""
        cls._instance = None

    @classmethod
    def on_startup(cls, env_file: str = ".env", logger: Optional[IVaultFileLogger] = None) -> LoadResult:
        instance = cls.get_instance()
        if logger is not None:
            instance._logger = logger
        if not env_file:
            raise ValueError("Environment file path is required")

        instance._initialized = True

        if os.path.exists(env_file):
            try:
                from .core import parse_env_file
                parsed = parse_env_file(env_file)
                for k, v in parsed.items():
                    instance._store[k] = v
            except Exception as err:
                instance._logger.error(f"Failed to parse env file: {err}")
                raise
        else:
            instance._logger.warn(f"Env file not found: {os.path.abspath(env_file)}")

        instance._total_vars_loaded = len(os.environ) + len(instance._store)
        return LoadResult(total_vars_loaded=instance._total_vars_loaded)

    @classmethod
    def get(cls, key: str, default: Optional[str] = None) -> Optional[str]:
        instance = cls.get_instance()
        # Python Priority: Internal Store > System Environment
        if key in instance._store:
            return instance._store[key]
        env_val = os.environ.get(key)
        if env_val is not None:
            return env_val
        return default

    @classmethod
    def get_or_throw(cls, key: str) -> str:
        if not key:
            raise ValueError("Key is required")
        value = cls.get(key)
        if value is None:
            raise EnvKeyNotFoundError(key)
        return value

    @classmethod
    def is_initialized(cls) -> bool:
        return cls._instance is not None and cls._instance._initialized
