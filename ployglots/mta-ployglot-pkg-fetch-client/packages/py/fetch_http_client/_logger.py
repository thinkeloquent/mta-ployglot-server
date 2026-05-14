"""Structured logger with JSON/pretty formats and 6 levels.

Pulls from LOG_LEVEL / LOG_FORMAT / PYTHON_ENV env vars. In production
the default format flips to JSON; in dev it's pretty-printed.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any


class LogLevel(IntEnum):
    TRACE = 5
    DEBUG = 10
    INFO = 20
    WARN = 30
    ERROR = 40
    SILENT = 100


_LEVEL_NAMES = {
    LogLevel.TRACE: "TRACE",
    LogLevel.DEBUG: "DEBUG",
    LogLevel.INFO: "INFO",
    LogLevel.WARN: "WARN",
    LogLevel.ERROR: "ERROR",
    LogLevel.SILENT: "SILENT",
}

_NAME_TO_LEVEL = {v: k for k, v in _LEVEL_NAMES.items()}

_REDACT_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "x-figma-token",
        "statsig-api-key",
        "password",
        "token",
        "api_key",
        "apikey",
        "secret",
        "access_key",
    }
)

_REDACTED = "[REDACTED]"


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            k: (_REDACTED if k.lower() in _REDACT_KEYS else _redact(v)) for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


def _env_level() -> LogLevel:
    raw = os.environ.get("LOG_LEVEL", "INFO").upper()
    return _NAME_TO_LEVEL.get(raw, LogLevel.INFO)


def _env_format() -> str:
    raw = os.environ.get("LOG_FORMAT")
    if raw in ("json", "pretty"):
        return raw
    env = os.environ.get("PYTHON_ENV", "development").lower()
    return "json" if env == "production" else "pretty"


@dataclass
class Logger:
    name: str
    level: LogLevel = field(default_factory=_env_level)
    format: str = field(default_factory=_env_format)
    context: dict[str, Any] = field(default_factory=dict)
    _out: Any = field(default=None, repr=False)

    def __post_init__(self) -> None:
        if self._out is None:
            self._out = sys.stderr

    # ---- factories ----------------------------------------------------------

    def child(self, **extra_context: Any) -> Logger:
        return Logger(
            name=self.name,
            level=self.level,
            format=self.format,
            context={**self.context, **extra_context},
            _out=self._out,
        )

    def with_level(self, level: LogLevel) -> Logger:
        return Logger(
            name=self.name,
            level=level,
            format=self.format,
            context=dict(self.context),
            _out=self._out,
        )

    # ---- level methods ------------------------------------------------------

    def trace(self, msg: str, **fields: Any) -> None:
        self._emit(LogLevel.TRACE, msg, fields)

    def debug(self, msg: str, **fields: Any) -> None:
        self._emit(LogLevel.DEBUG, msg, fields)

    def info(self, msg: str, **fields: Any) -> None:
        self._emit(LogLevel.INFO, msg, fields)

    def warn(self, msg: str, **fields: Any) -> None:
        self._emit(LogLevel.WARN, msg, fields)

    warning = warn

    def error(self, msg: str, **fields: Any) -> None:
        self._emit(LogLevel.ERROR, msg, fields)

    # ---- emit ---------------------------------------------------------------

    def _emit(self, level: LogLevel, msg: str, fields: dict[str, Any]) -> None:
        if level < self.level:
            return
        record = {
            "time": int(time.time() * 1000),
            "level": _LEVEL_NAMES[level],
            "name": self.name,
            "msg": msg,
            **_redact({**self.context, **fields}),
        }
        if self.format == "json":
            line = json.dumps(record, default=str)
        else:
            extras = " ".join(
                f"{k}={json.dumps(v, default=str)}"
                for k, v in record.items()
                if k not in ("time", "level", "name", "msg")
            )
            line = f"[{record['level']}] {record['name']}: {msg}" + (f" {extras}" if extras else "")
        self._out.write(line + "\n")
        with contextlib.suppress(Exception):
            self._out.flush()


def create_logger(name: str, **context: Any) -> Logger:
    """Factory: create a logger with module-scoped context."""
    return Logger(name=name, context=context)


# Bridge into stdlib logging — harmless if the caller never touches stdlib.
logging.addLevelName(LogLevel.TRACE, "TRACE")


__all__ = ["LogLevel", "Logger", "create_logger"]
