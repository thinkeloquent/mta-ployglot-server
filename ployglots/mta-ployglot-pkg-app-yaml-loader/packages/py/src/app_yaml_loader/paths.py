"""Path-resolution helpers — pure functions, no IO."""

from __future__ import annotations

import os
import os.path

DEFAULT_BASE_FILES: tuple[str, ...] = (
    "base.yml",
    "security.yml",
    "api-release-date.yml",
    "feature_flags.yml",
)

DEFAULT_ENV_SUFFIXES: tuple[str, ...] = ("server", "endpoint")


def resolve_config_dir(override: str | None = None, caller_dir: str | None = None) -> str:
    if override is not None:
        if override == "":
            raise ValueError("config_dir must not be an empty string")
        return override
    env_val = os.environ.get("CONFIG_DIR")
    if env_val is not None:
        if env_val == "":
            raise ValueError("CONFIG_DIR env var must not be an empty string")
        return env_val
    if caller_dir:
        # Match mjs `path.join` which collapses `..` segments lexically.
        return os.path.normpath(
            os.path.join(caller_dir, "..", "..", "..", "..", "common", "config")
        )
    raise ValueError(
        "config_dir is required: pass it explicitly, set CONFIG_DIR env var, or provide caller_dir"
    )


def resolve_app_env(override: str | None = None) -> str:
    return (override or os.environ.get("APP_ENV") or "dev").lower()


def build_config_files(
    config_dir: str,
    app_env: str,
    base_files: list[str] | tuple[str, ...] | None = None,
    env_suffixes: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    base = DEFAULT_BASE_FILES if base_files is None else tuple(base_files)
    suffixes = DEFAULT_ENV_SUFFIXES if env_suffixes is None else tuple(env_suffixes)
    return [
        *(os.path.join(config_dir, f) for f in base),
        *(os.path.join(config_dir, f"{prefix}.{app_env}.yaml") for prefix in suffixes),
    ]
