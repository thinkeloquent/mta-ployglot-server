"""polyglot-vault-file — public barrel."""
from .domain import VaultFile, VaultHeader, LoadResult
from .core import to_json, from_json, parse_env_file
from .env_store import EnvStore
from .validators import EnvKeyNotFoundError
from .logger import get_logger, set_log_level, LogLevel
from .protocols import VaultFileProtocol, EnvStoreProtocol
from .sdk import VaultFileSDK, VaultFileSDKBuilder
from .sdk_types import (
    SDKResult,
    SDKError,
    ConfigDescription,
    SecretInfo,
    ValidationResult,
    DiagnosticResult,
    VaultFileSDKProtocol,
)

__all__ = [
    "VaultFile",
    "VaultHeader",
    "LoadResult",
    "to_json",
    "from_json",
    "parse_env_file",
    "EnvStore",
    "EnvKeyNotFoundError",
    "get_logger",
    "set_log_level",
    "LogLevel",
    "VaultFileProtocol",
    "EnvStoreProtocol",
    "VaultFileSDK",
    "VaultFileSDKBuilder",
    "SDKResult",
    "SDKError",
    "ConfigDescription",
    "SecretInfo",
    "ValidationResult",
    "DiagnosticResult",
    "VaultFileSDKProtocol",
]
