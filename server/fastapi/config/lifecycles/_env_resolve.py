"""EnvResolver helper — wraps env-resolve as a Depends()-injectable object.

The numeric-prefixed lifecycle file `15_env_resolve.lifecycle.py` is loaded
dynamically by path (its name is not a valid Python identifier), so the
class definition lives here where `_di.py` can import it directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from env_resolve import (
    TRUTHY_STRINGS,
    resolve,
    resolve_bool,
    resolve_float,
    resolve_int,
)


@dataclass(frozen=True)
class EnvResolver:
    """Stateless helper bound to an optional server-wide config dict."""

    config: dict[str, Any] | None = None

    def resolve(
        self,
        arg: Any,
        env_keys: str | list[str] | None,
        config_key: str | None,
        default: Any,
    ) -> Any:
        return resolve(arg, env_keys, self.config, config_key, default)

    def resolve_bool(
        self,
        arg: Any,
        env_keys: str | list[str] | None,
        config_key: str | None,
        default: bool,
    ) -> bool:
        return resolve_bool(arg, env_keys, self.config, config_key, default)

    def resolve_int(
        self,
        arg: Any,
        env_keys: str | list[str] | None,
        config_key: str | None,
        default: int,
    ) -> int:
        return resolve_int(arg, env_keys, self.config, config_key, default)

    def resolve_float(
        self,
        arg: Any,
        env_keys: str | list[str] | None,
        config_key: str | None,
        default: float,
    ) -> float:
        return resolve_float(arg, env_keys, self.config, config_key, default)

    def with_config(self, override: dict[str, Any] | None) -> "EnvResolver":
        return EnvResolver(config=override if override is not None else self.config)


__all__ = ["EnvResolver", "TRUTHY_STRINGS"]
