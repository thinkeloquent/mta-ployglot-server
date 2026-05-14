"""YAML loader — read + parse + return ordered map keyed by absolute path."""

from __future__ import annotations

import logging
import os
import os.path
from collections import OrderedDict
from typing import Any, Iterable, Literal

import yaml

from . import _io
from .cache import cache_get, cache_set, is_miss
from .errors import LoadError
from .paths import build_config_files, resolve_app_env, resolve_config_dir

_VALID_MISSING = ("raise", "skip")

_DEFAULT_LOGGER = logging.getLogger("app_yaml_loader")


def load_files(
    paths: Iterable[str],
    *,
    missing: Literal["raise", "skip"] = "raise",
    force: bool = False,
    logger: logging.Logger | None = None,
) -> "OrderedDict[str, Any]":
    if missing not in _VALID_MISSING:
        raise ValueError(f"Invalid missing strategy: {missing}")

    log = logger if logger is not None else _DEFAULT_LOGGER

    out: "OrderedDict[str, Any]" = OrderedDict()

    for p in paths:
        if not isinstance(p, str):
            raise TypeError(f"paths[*] must be str, got {type(p).__name__}")
        abs_path = os.path.abspath(p)

        if not force:
            hit = cache_get(abs_path)
            if not is_miss(hit):
                out[abs_path] = hit
                continue

        try:
            raw = _io.read_text(abs_path)
        except FileNotFoundError as e:
            if missing == "skip":
                log.warning("app-yaml-loader: skipping missing file %s", abs_path)
                continue
            raise LoadError(f"Failed to read {abs_path}", path=abs_path, cause=e) from e
        except OSError as e:
            raise LoadError(f"Failed to read {abs_path}", path=abs_path, cause=e) from e

        try:
            parsed = yaml.safe_load(raw)
        except yaml.YAMLError as e:
            raise LoadError(f"Failed to parse {abs_path}", path=abs_path, cause=e) from e

        if parsed is None:
            parsed = {}

        cache_set(abs_path, parsed)
        out[abs_path] = cache_get(abs_path)

    return out


def load_from_config_dir(
    *,
    config_dir: str | None = None,
    caller_dir: str | None = None,
    app_env: str | None = None,
    base_files: list[str] | tuple[str, ...] | None = None,
    env_suffixes: list[str] | tuple[str, ...] | None = None,
    missing: Literal["raise", "skip"] = "raise",
    force: bool = False,
    logger: logging.Logger | None = None,
) -> "OrderedDict[str, Any]":
    resolved_dir = resolve_config_dir(config_dir, caller_dir)
    resolved_env = resolve_app_env(app_env)
    files = build_config_files(resolved_dir, resolved_env, base_files, env_suffixes)
    return load_files(files, missing=missing, force=force, logger=logger)
