export default async function healthzRoutes(fastify, config) {
  const payload = () => ({
    status: "ok",
    service: config.title,
    profile: config.profile,
    build_id: process.env.BUILD_ID,
    build_version: process.env.BUILD_VERSION,
  });

  fastify.get("/healthz", async () => payload());
  fastify.get("/health", async () => payload());

  fastify.get("/_reports", async () => fastify._loaderReports);
}
