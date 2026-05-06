// Slot 36 — POST /api/runtime-app-config/endpoints/refresh.
// Re-reads endpoint.dev.yaml via slot 29's SDK; returns the new endpoint count.
// Intentionally minimal: no auth, no validation. Production wraps with middleware.

export default async function endpointsRefreshRoutes(fastify, _config) {
  fastify.post("/api/runtime-app-config/endpoints/refresh", async (_request, reply) => {
    const handle = fastify.app_yaml_fetch_config;
    if (!handle?.sdk) {
      return reply.code(500).send({ ok: false, error: "app_yaml_fetch_config.sdk missing" });
    }
    try {
      handle.sdk.refreshConfig();
      const count = handle.sdk.listKeys().length;
      return { ok: true, endpoint_count: count, refreshed_at: new Date().toISOString() };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: String(err.message ?? err) });
    }
  });
}
