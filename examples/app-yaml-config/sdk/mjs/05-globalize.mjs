#!/usr/bin/env node
// F02 / story 03b — mergeGlobalIntoProviders fan-out vs override.
// global.client values fan out into every providers.<name>; provider-specific
// overrides win on conflict.
import { resetAndInit, stable } from "./_init.mjs";

const inst = await resetAndInit();
const original = inst.getOriginal("server.dev.yaml") ?? {};

console.log(stable({
  global_client_pre_globalize: inst.getNested(["global", "client"]),
  anthropic_client_post_globalize: inst.getNested(["providers", "anthropic", "client"]),
  gemini_client_post_globalize: inst.getNested(["providers", "gemini_openai", "client"]),
  anthropic_client_in_original_server_dev_yaml: original.providers?.anthropic?.client ?? null,
  gemini_client_in_original_server_dev_yaml: original.providers?.gemini_openai?.client ?? null,
}));
