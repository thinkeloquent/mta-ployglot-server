"""LoaderHandle helper — wraps app_yaml_loader as a Depends()-injectable object.

The numeric-prefixed lifecycle file `25_app_yaml_loader.lifecycle.py` is loaded
dynamically by path (its name is not a valid Python identifier), so the class
definition lives here where `_di.py` can import it directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app_yaml_loader import (
    LoadError,
    clear_cache,
    load_files,
    load_from_config_dir,
    resolve_config_dir,
)


@dataclass(frozen=True)
class LoaderHandle:
    """Bound to an optional default config directory."""

    config_dir: str | None = None

    def load_from_config_dir(
        self,
        config_dir: str | None = None,
        *,
        missing: Literal["raise", "skip"] = "raise",
        base_files: list[str] | tuple[str, ...] | None = None,
        env_suffixes: list[str] | tuple[str, ...] | None = None,
        app_env: str | None = None,
        force: bool = False,
        logger=None,
    ) -> dict[str, Any]:
        return load_from_config_dir(
            config_dir=config_dir or self.config_dir,
            missing=missing,
            base_files=base_files,
            env_suffixes=env_suffixes,
            app_env=app_env,
            force=force,
            logger=logger,
        )

    def load_files(
        self,
        paths: list[str],
        *,
        missing: Literal["raise", "skip"] = "raise",
        force: bool = False,
        logger=None,
    ) -> dict[str, Any]:
        return load_files(paths, missing=missing, force=force, logger=logger)

    def resolve_config_dir(self) -> str:
        return resolve_config_dir(self.config_dir)

    def clear_cache(self) -> int:
        return clear_cache()


__all__ = ["LoaderHandle", "LoadError"]
