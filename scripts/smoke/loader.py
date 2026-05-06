#!/usr/bin/env python3
"""Smoke: prove app_yaml_loader loads the shared server/config/ directory."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "server" / "config"

sys.path.insert(0, str(ROOT / "server" / "fastapi"))
from config.lifecycles._app_yaml_loader import LoaderHandle  # noqa: E402

handle = LoaderHandle(config_dir=str(CONFIG_DIR))
loaded = handle.load_from_config_dir()
print(
    "loaded keys:",
    sorted(loaded.keys()) if isinstance(loaded, dict) else type(loaded).__name__,
)
assert loaded, "expected at least one loaded fixture file"
