#!/usr/bin/env python3
"""F02 / story 03b — merge_global_into_providers fan-out vs override."""
from __future__ import annotations

from _init import reset_and_init, run, stable


async def main():
    inst = await reset_and_init()
    original = inst.get_original("server.dev.yaml") or {}
    providers = original.get("providers") or {}

    print(stable({
        "global_client_pre_globalize": inst.get_nested(["global", "client"]),
        "anthropic_client_post_globalize": inst.get_nested(["providers", "anthropic", "client"]),
        "gemini_client_post_globalize": inst.get_nested(["providers", "gemini_openai", "client"]),
        "anthropic_client_in_original_server_dev_yaml": (providers.get("anthropic") or {}).get("client"),
        "gemini_client_in_original_server_dev_yaml": (providers.get("gemini_openai") or {}).get("client"),
    }))


if __name__ == "__main__":
    run(main)
