#!/usr/bin/env node
// F02 / story 02 — every getter style: getNested, dot-`get`, list accessors.
import { AppYamlConfigSDK } from "@ployglot/app-yaml-config";
import { resetAndInit, stable } from "./_init.mjs";

const inst = await resetAndInit();

// Synthesize the SDK wrapper (constructor takes the singleton instance).
const sdk = new AppYamlConfigSDK(inst);

console.log(stable({
  providers: sdk.listProviders().sort(),
  services: sdk.listServices().sort(),
  storages: sdk.listStorages().sort(),
  deep_path_examples: {
    "providers.gemini_openai.base_url": sdk.get("providers.gemini_openai.base_url"),
    "providers.gemini_openai.client.timeout_seconds": sdk.get("providers.gemini_openai.client.timeout_seconds"),
    "global.client.timeout_seconds": sdk.get("global.client.timeout_seconds"),
    "feature_options.figma_component_inspector.image.image_rendering_type": sdk.get("feature_options.figma_component_inspector.image.image_rendering_type"),
    "component_ingest.framework.ant-design.import_packages": sdk.get("component_ingest.framework.ant-design.import_packages"),
    "intent_mapping.default_intent": sdk.get("intent_mapping.default_intent"),
    "missing.path.returns.default": sdk.get("missing.path.returns.default", "(none)"),
  },
  getNested_examples: {
    "providers.openai.base_url": inst.getNested(["providers", "openai", "base_url"]),
    "missing.deep.path": inst.getNested(["missing", "deep", "path"], null),
  },
}));
