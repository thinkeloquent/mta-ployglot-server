"""VaultFileSDK + VaultFileSDKBuilder."""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Literal, Optional

from .core import parse_env_file
from .env_store import EnvStore
from .logger import IVaultFileLogger, Logger
from .sdk_types import (
    ConfigDescription,
    DiagnosticResult,
    SDKError,
    SDKResult,
    SecretInfo,
    ValidationResult,
)


class VaultFileSDK:
    def __init__(self, logger: Optional[IVaultFileLogger] = None) -> None:
        self._env_path: Optional[str] = None
        self._base64_parsers: Dict[str, Callable[[str], str]] = {}
        self._logger: IVaultFileLogger = logger or Logger.create("polyglot_vault_file", "sdk")

    @classmethod
    def create(cls) -> "VaultFileSDKBuilder":
        return VaultFileSDKBuilder()

    def set_env_path(self, path: str) -> None:
        self._env_path = path

    def set_base64_parsers(self, parsers: Dict[str, Callable[[str], str]]) -> None:
        self._base64_parsers = parsers

    def set_logger(self, logger: IVaultFileLogger) -> None:
        self._logger = logger

    def _success(self, data: Any) -> SDKResult:
        return SDKResult(success=True, data=data)

    def _failure(self, code: str, message: str, details: Optional[Dict[str, Any]] = None) -> SDKResult:
        return SDKResult(success=False, error=SDKError(code=code, message=message, details=details))

    def load_config(self) -> SDKResult:
        try:
            result = EnvStore.on_startup(self._env_path or ".env", self._logger)
            return self._success(result)
        except Exception as err:
            return self._failure("LOAD_FAILED", str(err), {"envPath": self._env_path})

    def load_from_path(self, file_path: str) -> SDKResult:
        try:
            result = EnvStore.on_startup(file_path, self._logger)
            return self._success(result)
        except Exception as err:
            return self._failure("LOAD_FAILED", str(err), {"filePath": file_path})

    def validate_file(self, file_path: str) -> SDKResult:
        errors: List[str] = []
        warnings: List[str] = []
        try:
            parsed = parse_env_file(file_path)
            if not parsed:
                warnings.append("file parsed to empty map")
            return self._success(
                ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)
            )
        except Exception as err:
            errors.append(str(err))
            return self._success(ValidationResult(valid=False, errors=errors, warnings=warnings))

    def export_to_format(self, format: Literal["json", "yaml"], path: str) -> SDKResult:
        """Stub — returns SDKResult with error.code 'NOT_IMPLEMENTED'."""
        return self._failure("NOT_IMPLEMENTED", "export_to_format is a stub")

    def describe_config(self) -> SDKResult:
        vars_count = EnvStore._get_total_vars_loaded()
        return self._success(
            ConfigDescription(
                version="1.0.0",
                vars_count=vars_count,
                source=self._env_path or ".env",
            )
        )

    def get_secret_safe(self, key: str) -> SDKResult:
        value = EnvStore.get(key)
        if value is None:
            return self._failure("KEY_NOT_FOUND", f"key '{key}' not present")
        return self._success(SecretInfo(key=key, masked="***", exists=True))

    def list_available_keys(self) -> SDKResult:
        """Stub — returns empty list."""
        return self._success([])

    def diagnose_env_store(self) -> SDKResult:
        return self._success(
            DiagnosticResult(
                initialized=EnvStore.is_initialized(),
                vars_loaded=EnvStore._get_total_vars_loaded(),
                source=self._env_path,
            )
        )

    def find_missing_required(self, keys: List[str]) -> SDKResult:
        missing = [k for k in keys if EnvStore.get(k) is None]
        return self._success(missing)

    def suggest_missing_keys(self, partial: str) -> SDKResult:
        """Stub — returns empty list."""
        return self._success([])


class VaultFileSDKBuilder:
    def __init__(self) -> None:
        self._env_path: Optional[str] = None
        self._base64_parsers: Dict[str, Callable[[str], str]] = {}
        self._logger: Optional[IVaultFileLogger] = None

    def with_env_path(self, path: str) -> "VaultFileSDKBuilder":
        self._env_path = path
        return self

    def with_base64_parsers(self, parsers: Dict[str, Callable[[str], str]]) -> "VaultFileSDKBuilder":
        self._base64_parsers = parsers
        return self

    def with_logger(self, logger: IVaultFileLogger) -> "VaultFileSDKBuilder":
        self._logger = logger
        return self

    def build(self) -> VaultFileSDK:
        sdk_logger = (
            self._logger
            if self._logger is not None
            else Logger.create("polyglot_vault_file", "sdk")
        )
        sdk = VaultFileSDK(logger=sdk_logger)
        if self._env_path is not None:
            sdk.set_env_path(self._env_path)
        sdk.set_base64_parsers(self._base64_parsers)
        return sdk
