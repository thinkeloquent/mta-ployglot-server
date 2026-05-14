"""ComputeScope and MissingStrategy enums."""

from __future__ import annotations

from enum import Enum


class ComputeScope(str, Enum):
    STARTUP = "STARTUP"
    REQUEST = "REQUEST"


class MissingStrategy(str, Enum):
    ERROR = "ERROR"
    IGNORE = "IGNORE"
    DEFAULT = "DEFAULT"
