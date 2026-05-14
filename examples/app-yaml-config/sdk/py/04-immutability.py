#!/usr/bin/env python3
"""F02 / story 04 — immutability + restore."""
from __future__ import annotations

import json
import sys

from app_yaml_config import ImmutabilityError
from _init import reset_and_init, run


async def main():
    inst = await reset_and_init()
    orig = inst.get_nested(["providers", "openai", "base_url"])

    # (1) deep-clone safety
    a = inst.get_nested(["providers", "openai"])
    a["base_url"] = "hacked-by-caller"
    b = inst.get_nested(["providers", "openai"])
    if b["base_url"] != orig:
        print("FAIL: deep-clone broken", file=sys.stderr)
        sys.exit(1)

    # (2) mutation API rejection
    for m in ("set", "update", "reset", "clear"):
        ok = False
        try:
            getattr(inst, m)("x", 1) if m in ("set", "update") else getattr(inst, m)()
        except ImmutabilityError:
            ok = True
        if not ok:
            print(f"FAIL: {m}() did not raise ImmutabilityError", file=sys.stderr)
            sys.exit(1)

    # (3) restore cycle
    inst._config["providers"]["openai"]["base_url"] = "changed-by-privileged"
    if inst.get_nested(["providers", "openai", "base_url"]) != "changed-by-privileged":
        print("FAIL: privileged mutation not visible", file=sys.stderr)
        sys.exit(1)
    inst.restore()
    if inst.get_nested(["providers", "openai", "base_url"]) != orig:
        print("FAIL: restore() did not reset", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({
        "invariants_passed": [
            "deep_clone_safe", "set_throws", "update_throws", "reset_throws",
            "clear_throws", "restore_resets",
        ],
        "original_openai_base_url": orig,
    }, indent=2))


if __name__ == "__main__":
    run(main)
