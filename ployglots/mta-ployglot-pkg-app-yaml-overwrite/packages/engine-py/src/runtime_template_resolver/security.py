"""Path-traversal validation for {{path.to.value}} lookups."""

from __future__ import annotations

from .errors import SecurityError

_BANNED_SEGMENTS = frozenset({"__proto__", "constructor", "prototype", "__class__", "__dict__"})


class Security:
    @staticmethod
    def validate_path(path: str) -> None:
        if not isinstance(path, str):
            return
        for part in path.split("."):
            if part in _BANNED_SEGMENTS:
                raise SecurityError(
                    f"Forbidden path segment: {part}",
                    {"path": path, "part": part},
                )
