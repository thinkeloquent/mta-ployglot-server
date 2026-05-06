#!/usr/bin/env node
// F04 / story 01 — overwrite_from_env overlay.
//
// To isolate the env-overlay (gemini_openai in server.dev.yaml has BOTH env AND
// context overlays, and context runs second + clobbers env), apply against a
// synthetic mini-config that has only overwrite_from_env. Then bonus: show the
// real-fixture layering effect.
import { applyOverwritesFromContext } from "@ployglot/app-yaml-from-context";
import { createResolver, MissingStrategy } from "@ployglot/runtime-template-resolver";
import { resetAndInit } from "./_init.mjs";

const inst = await resetAndInit();
const resolver = createResolver({ missingStrategy: MissingStrategy.IGNORE });

const synthetic = {
  providers: {
    gemini_openai: {
      base_url: "https://example.com",
      endpoint_api_key: null,
      overwrite_from_env: { endpoint_api_key: "GEMINI_API_KEY" },
    },
  },
};

process.env.GEMINI_API_KEY = "test-key-001";
const setMerged = await applyOverwritesFromContext(synthetic, { resolver, context: { env: process.env } });
const afterSet = setMerged.providers.gemini_openai.endpoint_api_key;

delete process.env.GEMINI_API_KEY;
const unsetMerged = await applyOverwritesFromContext(synthetic, { resolver, context: { env: process.env } });
const afterUnset = unsetMerged.providers.gemini_openai.endpoint_api_key;

// Bonus: real-fixture layering (env then context overlay; context wins).
process.env.GEMINI_API_KEY = "test-key-001";
const realMerged = await applyOverwritesFromContext(inst.getAll(), { resolver, context: { env: process.env } });
const realAfter = realMerged.providers.gemini_openai.endpoint_api_key;

console.log(JSON.stringify({
  synthetic_before: synthetic.providers.gemini_openai.endpoint_api_key,
  synthetic_after_set: afterSet,
  synthetic_after_unset: afterUnset,
  invariant_set_overlay_applied: afterSet === "test-key-001",
  invariant_unset_returns_nullish: afterUnset == null,
  layering_against_full_fixture: {
    field_after_overlay: realAfter,
    note: "overwrite_from_context runs after overwrite_from_env. In server.dev.yaml the context overlay is `{{fn:provider_api_keys.gemini_openai}}` (composite-property — unsupported by the regex), so it falls back to literal and wins over the env-resolved value.",
  },
}, null, 2));
