"""Domain models — VaultHeader, VaultFile, LoadResult."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Dict, Optional

from pydantic import BaseModel, Field, field_validator, ConfigDict


_SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:[-+].*)?$")


def _now_iso_ms() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class VaultHeader(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    version: str = "1.0.0"
    created_at: str = Field(default_factory=_now_iso_ms, alias="createdAt")
    description: Optional[str] = None

    @field_validator("version")
    @classmethod
    def _check_semver(cls, v: str) -> str:
        if not _SEMVER.match(v):
            raise ValueError(f"invalid semver: {v!r}")
        return v


class VaultFile(BaseModel):
    header: VaultHeader
    secrets: Dict[str, str]


class LoadResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_vars_loaded: int = Field(alias="totalVarsLoaded")
