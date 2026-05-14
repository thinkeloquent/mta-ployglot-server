"""Engine error hierarchy + ErrorCode constants."""

from __future__ import annotations

from typing import Any


class ErrorCode:
    COMPUTE_FUNCTION_NOT_FOUND = "COMPUTE_FUNCTION_NOT_FOUND"
    COMPUTE_FUNCTION_FAILED = "COMPUTE_FUNCTION_FAILED"
    RECURSION_LIMIT = "RECURSION_LIMIT"
    SECURITY = "SECURITY"
    SCOPE_VIOLATION = "SCOPE_VIOLATION"


class ComputeFunctionError(Exception):
    def __init__(self, message: str, code: str, ctx: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.ctx = ctx or {}


class RecursionLimitError(Exception):
    def __init__(self, message: str, ctx: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = ErrorCode.RECURSION_LIMIT
        self.ctx = ctx or {}


class SecurityError(Exception):
    def __init__(self, message: str, ctx: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = ErrorCode.SECURITY
        self.ctx = ctx or {}


class ScopeViolationError(Exception):
    def __init__(self, message: str, ctx: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = ErrorCode.SCOPE_VIOLATION
        self.ctx = ctx or {}
