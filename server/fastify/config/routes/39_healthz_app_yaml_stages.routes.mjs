// Slot 39 — GET /healthz/app-yaml-stage/:stage  (stage in raw|merged|applied|derived).
// Pure-read accessors over the boot-time pipeline state. Never re-merges or
// re-applies — slot 27/28/29 already did that work. Path uses the
// `app-yaml-stage` prefix to avoid colliding with slot 35's
// `/healthz/app-yaml/:intent` route.

import path from "node:path";
import {
  getConfig,
  listEndpoints,
  getEndpoint,
  resolveIntent,
} from "@ployglot/app-yaml-fetch-config";

const VALID_STAGES = Object.freeze(["raw", "merged", "applied", "derived"]);

const EXTRA_CONFIG_FILES = Object.freeze([
  "database_schema.yaml",
  "llm_rag.yml",
  "vite.yaml",
]);

async function stageRaw(loader) {
  const defaultLoaded = await loader.load_from_config_dir(undefined, {
    missing: "skip",
  });
  const extraPaths = EXTRA_CONFIG_FILES.map((f) =>
    path.join(loader.config_dir, f)
  );
  const extraLoaded = await loader.load_files(extraPaths, { missing: "skip" });
  const out = {};
  for (const [k, v] of defaultLoaded.entries()) out[k] = v;
  for (const [k, v] of extraLoaded.entries()) out[k] = v;
  return out;
}

function stageMerged(cfgSdk) {
  return cfgSdk.getAll();
}

function stageApplied() {
  return getConfig();
}

function stageDerived() {
  const keys = listEndpoints();
  const endpoints = Object.fromEntries(keys.map((k) => [k, getEndpoint(k)]));
  const applied = getConfig();
  const declared = Object.keys(applied?.intent_mapping?.mappings ?? {});
  const intent_resolutions = {};
  for (const intent of declared) {
    try {
      intent_resolutions[intent] = resolveIntent(intent);
    } catch {
      intent_resolutions[intent] = null;
    }
  }
  return {
    endpoint_keys: keys,
    endpoints,
    intent_resolutions,
    default_intent: applied?.intent_mapping?.default_intent ?? null,
  };
}

export default async function healthzAppYamlStagesRoutes(fastify, _config) {
  fastify.get("/healthz/app-yaml-stage/:stage", async (request, reply) => {
    const { stage } = request.params;
    if (!VALID_STAGES.includes(stage)) {
      return reply.code(400).send({
        ok: false,
        error: `unknown stage: ${stage}`,
        valid_stages: VALID_STAGES,
      });
    }

    try {
      let data;
      switch (stage) {
        case "raw":
          data = await stageRaw(request.app_yaml_loader);
          break;
        case "merged":
          data = stageMerged(request.app_yaml_config);
          break;
        case "applied":
          data = stageApplied();
          break;
        case "derived":
          data = stageDerived();
          break;
      }
      return { ok: true, stage, data };
    } catch (err) {
      return reply
        .code(500)
        .send({ ok: false, error: String(err.message ?? err) });
    }
  });
}
