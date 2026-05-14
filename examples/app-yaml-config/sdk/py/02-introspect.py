#!/usr/bin/env python3
"""F02 / story 02 — every getter style: get_nested, dot-`get`, list accessors."""
from __future__ import annotations

from app_yaml_config import AppYamlConfigSDK
from _init import reset_and_init, run, stable


async def main():
    inst = await reset_and_init()
    sdk = AppYamlConfigSDK(inst)

    print(stable({
        "providers": sorted(sdk.list_providers()),
        "services": sorted(sdk.list_services()),
        "storages": sorted(sdk.list_storages()),
        "deep_path_examples": {
            "providers.gemini_openai.base_url": sdk.get("providers.gemini_openai.base_url"),
            "providers.gemini_openai.client.timeout_seconds": sdk.get("providers.gemini_openai.client.timeout_seconds"),
            "global.client.timeout_seconds": sdk.get("global.client.timeout_seconds"),
            "feature_options.figma_component_inspector.image.image_rendering_type": sdk.get("feature_options.figma_component_inspector.image.image_rendering_type"),
            "component_ingest.framework.ant-design.import_packages": sdk.get("component_ingest.framework.ant-design.import_packages"),
            "intent_mapping.default_intent": sdk.get("intent_mapping.default_intent"),
            "missing.path.returns.default": sdk.get("missing.path.returns.default", "(none)"),
        },
        "getNested_examples": {
            "providers.openai.base_url": inst.get_nested(["providers", "openai", "base_url"]),
            "missing.deep.path": inst.get_nested(["missing", "deep", "path"], None),
        },
    }))


if __name__ == "__main__":
    run(main)
