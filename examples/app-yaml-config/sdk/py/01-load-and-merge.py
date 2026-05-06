#!/usr/bin/env python3
"""F02 / story 01 — load 9 fixtures from server/config/, prove merge + idempotent init."""
from __future__ import annotations

from app_yaml_config import AppYamlConfig
from app_yaml_loader import load_from_config_dir
from _init import CONFIG_DIR, reset_and_init, run, stable


async def main():
    inst = await reset_and_init()
    loaded = load_from_config_dir(config_dir=str(CONFIG_DIR))
    inst2 = await AppYamlConfig.initialize(loaded=loaded)

    print(stable({
        "config_dir": str(CONFIG_DIR),
        "top_level_keys": sorted(inst.get_all().keys()),
        "file_count": len(inst.get_original_all()),
        "same_instance": inst is inst2,
    }))


if __name__ == "__main__":
    run(main)
