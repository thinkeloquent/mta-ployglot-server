// Wildcard index. Catches `/` and any path not handled by an earlier route.
// Numeric prefix `99_` loads this last; find-my-way prefers specific routes
// (/healthz, /health, /_reports) over the `*` wildcard regardless of order,
// but keeping it last makes intent explicit.

export default async function wildcardRoutes(fastify, config) {
  const index = async (req) => ({
    service: config.title,
    profile: config.profile,
    method: req.method,
    path: req.url,
    endpoints: ["/health", "/healthz", "/_reports"],
    build_id: process.env.BUILD_ID,
    build_version: process.env.BUILD_VERSION,
  });

  fastify.get("/", index);
  fastify.get("/*", index);
}
