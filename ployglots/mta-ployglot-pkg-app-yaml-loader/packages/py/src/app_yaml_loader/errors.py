"""LoadError — wraps read/parse failures with .path + .cause."""

from __future__ import annotations


class LoadError(Exception):
    def __init__(
        self,
        message: str,
        *,
        path: str | None = None,
        cause: BaseException | None = None,
    ) -> None:
        super().__init__(message)
        self.path = path
        if cause is not None:
            self.__cause__ = cause
