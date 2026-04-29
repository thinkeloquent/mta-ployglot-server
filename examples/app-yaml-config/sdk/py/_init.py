"""Shared bootstrap: load 9 fixtures, init AppYamlConfig singleton."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app_yaml_config import AppYamlConfig
from app_yaml_loader import load_files

HERE = Path(__file__).resolve().parent
# mta-ployglot-server/examples/sdk/py/ → ../../../server/config
CONFIG_DIR = (HERE / ".." / ".." / ".." / "server" / "config").resolve()


async def reset_and_init():
    # Test-only escape from singleton; safe to call repeatedly.
    AppYamlConfig._instance = None
    # Load EVERY *.yml/*.yaml; loader default base set is only 6 names.
    files = sorted(str(p) for p in CONFIG_DIR.iterdir() if p.suffix in {".yml", ".yaml"})
    full_key_map = load_files(files)
    # Re-key by basename so get_original('base.yml') resolves cleanly.
    loaded = {Path(k).name: v for k, v in full_key_map.items()}
    return await AppYamlConfig.initialize(loaded=loaded)


def run(coro_fn):
    """Tiny driver so each example file is `if __name__ == '__main__': run(main)`."""
    asyncio.run(coro_fn())


def stable(obj):
    return json.dumps(obj, indent=2, sort_keys=True, default=str)
