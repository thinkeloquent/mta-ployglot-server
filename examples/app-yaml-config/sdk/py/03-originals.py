#!/usr/bin/env python3
"""F02 / story 03 — get_original + get_original_all: per-file pre-merge snapshots."""
from __future__ import annotations

from _init import reset_and_init, run, stable


async def main():
    inst = await reset_and_init()
    originals = inst.get_original_all()
    server_dev = inst.get_original("server.dev.yaml")

    print(stable({
        "original_files": sorted(originals.keys()),
        "file_count": len(originals),
        "server_dev_yaml_top_keys": sorted(server_dev.keys()) if server_dev else None,
        "base_yaml_pre_merge": inst.get_original("base.yml"),
        "nonexistent_file_lookup": inst.get_original("nonexistent.yml"),
    }))


if __name__ == "__main__":
    run(main)
