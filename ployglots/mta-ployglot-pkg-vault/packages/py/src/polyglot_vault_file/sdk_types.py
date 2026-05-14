"""SDK contract types — SDKResult, SDKError, and value types."""
from __future__ import annotations

from typing import Generic, List, Literal, Optional, Protocol, TypeVar, Dict, Any

from pydantic import BaseModel, ConfigDict, Field

from .domain import LoadResult


T = TypeVar("T")


class SDKError(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class SDKResult(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[SDKError] = None


class ConfigDescription(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    version: str
    vars_count: int = Field(alias="varsCount")
    source: str


class SecretInfo(BaseModel):
    key: str
    masked: str
    exists: bool


class ValidationResult(BaseModel):
    valid: bool
    errors: List[str]
    warnings: List[str]


class DiagnosticResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    initialized: bool
    vars_loaded: int = Field(alias="varsLoaded")
    source: Optional[str] = None


class VaultFileSDKProtocol(Protocol):
    def load_config(self) -> SDKResult[LoadResult]: ...
    def load_from_path(self, path: str) -> SDKResult[LoadResult]: ...
    def validate_file(self, path: str) -> SDKResult[ValidationResult]: ...
    def export_to_format(self, format: Literal["json", "yaml"], path: str) -> SDKResult[None]: ...
    def describe_config(self) -> SDKResult[ConfigDescription]: ...
    def get_secret_safe(self, key: str) -> SDKResult[SecretInfo]: ...
    def list_available_keys(self) -> SDKResult[List[str]]: ...
    def diagnose_env_store(self) -> SDKResult[DiagnosticResult]: ...
    def find_missing_required(self, keys: List[str]) -> SDKResult[List[str]]: ...
    def suggest_missing_keys(self, partial: str) -> SDKResult[List[str]]: ...
