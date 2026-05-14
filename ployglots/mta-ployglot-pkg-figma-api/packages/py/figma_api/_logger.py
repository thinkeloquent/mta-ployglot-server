"""Tiny structured logger + token-masking helper.

Matches the shape used elsewhere in the polyglot stack so downstream
logs stay uniform across the twin packages.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime
from typing import Any, Literal, Protocol, TextIO

LogLevel = Literal["trace", "debug", "info", "warn", "error", "silent"]

_RANK: dict[LogLevel, int] = {
    "trace": 0,
    "debug": 1,
    "info": 2,
    "warn": 3,
    "error": 4,
    "silent": 5,
}


class Logger(Protocol):
    def trace(self, msg: str, **fields: Any) -> None: ...
    def debug(self, msg: str, **fields: Any) -> None: ...
    def info(self, msg: str, **fields: Any) -> None: ...
    def warn(self, msg: str, **fields: Any) -> None: ...
    def error(self, msg: str, **fields: Any) -> None: ...
    def set_level(self, level: LogLevel) -> None: ...


def mask_token(token: str | None) -> str:
    """Mask a Figma token so it cannot leak into logs.

    Short tokens → ``***``. Long tokens → ``abcd…wxyz``.
    """
    if token is None or token == "":
        return "<empty>"
    if len(token) <= 8:
        return "***"
    return f"{token[:4]}…{token[-4:]}"


class _StreamLogger:
    def __init__(self, *, level: LogLevel, prefix: str, stream: TextIO) -> None:
        self._level: LogLevel = level
        self._prefix = prefix
        self._stream = stream

    def _emit(self, lvl: LogLevel, msg: str, fields: dict[str, Any]) -> None:
        if _RANK[lvl] < _RANK[self._level]:
            return
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": lvl,
            "logger": self._prefix,
            "msg": msg,
        }
        payload.update(fields)
        self._stream.write(json.dumps(payload) + "\n")

    def trace(self, msg: str, **fields: Any) -> None:
        self._emit("trace", msg, fields)

    def debug(self, msg: str, **fields: Any) -> None:
        self._emit("debug", msg, fields)

    def info(self, msg: str, **fields: Any) -> None:
        self._emit("info", msg, fields)

    def warn(self, msg: str, **fields: Any) -> None:
        self._emit("warn", msg, fields)

    def error(self, msg: str, **fields: Any) -> None:
        self._emit("error", msg, fields)

    def set_level(self, level: LogLevel) -> None:
        self._level = level


def create_logger(
    *,
    level: LogLevel | None = None,
    prefix: str = "figma-api",
    stream: TextIO | None = None,
) -> Logger:
    lvl: LogLevel = level or os.environ.get("LOG_LEVEL", "info").lower()  # type: ignore[assignment]
    if lvl not in _RANK:
        lvl = "info"
    return _StreamLogger(level=lvl, prefix=prefix, stream=stream or sys.stderr)
