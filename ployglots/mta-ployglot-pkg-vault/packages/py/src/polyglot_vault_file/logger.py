"""Logger + LogLevel."""
from __future__ import annotations

import logging
from enum import IntEnum
from typing import Protocol, Any


class LogLevel(IntEnum):
    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3
    NONE = 4


class IVaultFileLogger(Protocol):
    def debug(self, msg: str, *args: Any) -> None: ...
    def info(self, msg: str, *args: Any) -> None: ...
    def warn(self, msg: str, *args: Any) -> None: ...
    def error(self, msg: str, *args: Any) -> None: ...


class Logger:
    def __init__(self, package_name: str, filename: str) -> None:
        self._pkg = package_name
        self._file = filename
        self._log = logging.getLogger(f"{package_name}.{filename}")
        if not self._log.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter("%(message)s"))
            self._log.addHandler(handler)

    @staticmethod
    def create(package_name: str, filename: str) -> "IVaultFileLogger":
        return Logger(package_name, filename)  # type: ignore[return-value]

    def _format(self, message: str) -> str:
        return f"[{self._pkg}][{self._file}] {message}"

    def debug(self, msg: str, *args: Any) -> None:
        if _current_log_level <= LogLevel.DEBUG:
            self._log.debug(self._format(msg), *args)

    def info(self, msg: str, *args: Any) -> None:
        if _current_log_level <= LogLevel.INFO:
            self._log.info(self._format(msg), *args)

    def warn(self, msg: str, *args: Any) -> None:
        if _current_log_level <= LogLevel.WARN:
            self._log.warning(self._format(msg), *args)

    def error(self, msg: str, *args: Any) -> None:
        if _current_log_level <= LogLevel.ERROR:
            self._log.error(self._format(msg), *args)


_current_log_level: LogLevel = LogLevel.DEBUG


def set_log_level(level: LogLevel) -> None:
    global _current_log_level
    _current_log_level = level
    logging.getLogger().setLevel({
        LogLevel.DEBUG: logging.DEBUG,
        LogLevel.INFO: logging.INFO,
        LogLevel.WARN: logging.WARNING,
        LogLevel.ERROR: logging.ERROR,
        LogLevel.NONE: logging.CRITICAL + 1,
    }[level])


_default_logger: IVaultFileLogger = Logger.create("polyglot_vault_file", "default")


def get_logger() -> IVaultFileLogger:
    return _default_logger
