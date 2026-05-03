// Slot 37 — GET /healthz/app-yaml-file/server/config/endpoint.dev.yaml.
// Returns the post-pipeline (merge + overwrite + compute) view of
// endpoint.dev.yaml as the fetch SDK has it loaded right now. Boot
// pipeline (slots 25 -> 27 -> 28 -> 29) already produced this state via
// loadConfig(merged); re-doing the work here would just diverge.

import { getConfig } from "@ployglot/app-yaml-fetch-config";

export default async function healthzAppYamlFileRoutes(fastify, _config) {
  fastify.get(
    "/healthz/app-yaml-file/server/config/endpoint.dev.yaml",
    async (_request, reply) => {
      try {
        return { ok: true, data: getConfig() };
      } catch (err) {
        return reply
          .code(500)
          .send({ ok: false, error: String(err.message ?? err) });
      }
    }
  );
}
