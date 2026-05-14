// Slot 37 — GET /healthz/app-yaml-file/server/config/endpoint.dev.yaml.
// Returns the post-pipeline view of the global config with template
// expressions ({{app.*}}, {{fn:foo.bar}}, {{request.*}}, {{env.*}})
// resolved against the live request context — what the caller would
// see at runtime.

import { getConfig } from "@ployglot/app-yaml-fetch-config";

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

export default async function healthzAppYamlFileRoutes(fastify, _config) {
  fastify.get(
    "/healthz/app-yaml-file/server/config/endpoint.dev.yaml",
    async (request, reply) => {
      try {
        const cfg = getConfig();
        const resolver = request.runtime_template_resolver;
        if (!resolver) {
          return { ok: true, data: cfg };
        }
        const ctx = buildRequestContext(request, cfg);
        const resolved = await resolver.resolveObject(cfg, ctx);
        return { ok: true, data: resolved };
      } catch (err) {
        return reply
          .code(500)
          .send({ ok: false, error: String(err.message ?? err) });
      }
    }
  );
}
