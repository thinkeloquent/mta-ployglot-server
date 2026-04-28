export default async function healthzAppYamlRoutes(fastify, _config) {
  fastify.get("/healthz/app-yaml/:intent", async (request, reply) => {
    try {
      const cfg = request.app_yaml_fetch_config.get_fetch_config(
        request.params.intent,
        {}
      );
      return { ok: true, data: cfg };
    } catch (err) {
      return reply.code(404).send({ ok: false, error: String(err.message ?? err) });
    }
  });
}
