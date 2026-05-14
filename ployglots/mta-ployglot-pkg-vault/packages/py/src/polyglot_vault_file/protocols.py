"""Protocols — VaultFileProtocol, EnvStoreProtocol."""
from __future__ import annotations

from typing import Dict, Optional, Protocol

from .domain import VaultHeader


class VaultFileProtocol(Protocol):
    header: VaultHeader
    secrets: Dict[str, str]


class EnvStoreProtocol(Protocol):
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]: ...
    def get_or_throw(self, key: str) -> str: ...
    def is_initialized(self) -> bool: ...
