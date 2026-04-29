#!/usr/bin/env python3
"""F04 / story 01 — overwrite_from_env overlay (synthetic + real-fixture layering)."""
from __future__ import annotations

import json
import os

from app_yaml_from_context import apply_overwrites_from_context
from runtime_template_resolver import MissingStrategy, create_resolver
from _init import reset_and_init, run


async def main():
    inst = await reset_and_init()
    resolver = create_resolver(missing_strategy=MissingStrategy.IGNORE)

    synthetic = {
        "providers": {
            "gemini_openai": {
                "base_url": "https://example.com",
                "endpoint_api_key": None,
                "overwrite_from_env": {"endpoint_api_key": "GEMINI_API_KEY"},
            }
        }
    }

    os.environ["GEMINI_API_KEY"] = "test-key-001"
    set_merged = await apply_overwrites_from_context(synthetic, resolver=resolver, context={"env": dict(os.environ)})
    after_set = set_merged["providers"]["gemini_openai"]["endpoint_api_key"]

    os.environ.pop("GEMINI_API_KEY", None)
    unset_merged = await apply_overwrites_from_context(synthetic, resolver=resolver, context={"env": dict(os.environ)})
    after_unset = unset_merged["providers"]["gemini_openai"]["endpoint_api_key"]

    os.environ["GEMINI_API_KEY"] = "test-key-001"
    real_merged = await apply_overwrites_from_context(inst.get_all(), resolver=resolver, context={"env": dict(os.environ)})
    real_after = real_merged["providers"]["gemini_openai"]["endpoint_api_key"]

    print(json.dumps({
        "synthetic_before": synthetic["providers"]["gemini_openai"]["endpoint_api_key"],
        "synthetic_after_set": after_set,
        "synthetic_after_unset": after_unset,
        "invariant_set_overlay_applied": after_set == "test-key-001",
        "invariant_unset_returns_nullish": after_unset in (None, ""),
        "layering_against_full_fixture": {
            "field_after_overlay": real_after,
            "note": "context overlay runs after env, wins on collision; here {{fn:provider_api_keys.gemini_openai}} is composite-property (unsupported regex) so falls back to literal.",
        },
    }, indent=2))


if __name__ == "__main__":
    run(main)
