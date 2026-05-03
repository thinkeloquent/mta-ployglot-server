// Slot 38 — GET /healthz/app-yaml-file/server/config/:filename.
// Per-file introspection backed by the loader's cache + the post-pipeline
// state. Slices the global merged/applied dicts to the file's top-level
// keys so the response says "this is what THIS file contributes".
//
// `applied` is re-resolved against a per-request context so template
// expressions ({{app.*}}, {{fn:foo.bar}}, {{request.*}}, {{env.*}})
// reach their final runtime value before being returned.

import path from "node:path";
import { getConfig } from "@ployglot/app-yaml-fetch-config";
import { assertSafeBasename } from "./_app_yaml_filename_guard.mjs";

function sliceToKeys(source, keys) {
  if (!source || typeof source !== "object") return null;
  return Object.fromEntries(keys.map((k) => [k, source[k] ?? null]));
}

function buildRequestContext(req, cfg) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    app: cfg && typeof cfg === "object" ? cfg.app : undefined,
    request: { headers, method: req.method, path: req.url },
  };
}

export default async function healthzAppYamlFileDynamicRoutes(fastify, _config) {
  fastify.get(
    "/healthz/app-yaml-file/server/config/:filename",
    async (request, reply) => {
      let filename;
      try {
        filename = assertSafeBasename(request.params.filename);
      } catch (err) {
        return reply.code(400).send({ ok: false, error: String(err.message) });
      }

      const loader = request.app_yaml_loader;
      const cfgSdk = request.app_yaml_config;
      if (!loader || !cfgSdk) {
        return reply
          .code(500)
          .send({ ok: false, error: "loader or config sdk missing" });
      }

      const filePath = path.join(loader.config_dir, filename);
      const absPath = path.resolve(filePath);

      let raw;
      try {
        const loaded = await loader.load_files([filePath], { missing: "skip" });
        raw = loaded.get(absPath) ?? null;
      } catch (err) {
        return reply
          .code(500)
          .send({ ok: false, error: String(err.message ?? err) });
      }

      if (raw === null) {
        return reply
          .code(404)
          .send({ ok: false, error: `file not found: ${filePath}` });
      }

      const keys = Object.keys(raw);
      const merged = sliceToKeys(cfgSdk.getAll(), keys);
      let applied = null;
      try {
        const fullCfg = getConfig();
        const slice = sliceToKeys(fullCfg, keys);
        const resolver = request.runtime_template_resolver;
        if (slice && resolver) {
          const ctx = buildRequestContext(request, fullCfg);
          applied = await resolver.resolveObject(slice, ctx);
        } else {
          applied = slice;
        }
      } catch {
        applied = null;
      }

      return { ok: true, file: absPath, raw, merged, applied };
    }
  );
}
