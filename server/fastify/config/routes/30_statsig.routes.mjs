export default async function statsigRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/statsig/gates", async (request, reply) => {
    const client = await request.fetchClient("statsig");
    try {
      const upstream = await client.get("/gates");
      if (upstream.status_code >= 400) {
        const body = await upstream.text();
        return reply.code(502).send({
          service: "statsig",
          connected: false,
          upstream_status: upstream.status_code,
          upstream_body: body.slice(0, 512),
        });
      }
      const body = await upstream.json();
      const gates = (body?.data ?? []).slice(0, 5).map((g) => ({
        id: g.id,
        name: g.name,
        isEnabled: g.isEnabled,
      }));
      return {
        service: "statsig",
        connected: true,
        host: process.env.STATSIG_BASE_URL ?? "https://statsigapi.net/console/v1",
        count: gates.length,
        gates,
      };
    } catch (err) {
      return reply.code(502).send({ service: "statsig", connected: false, error: err.message });
    }
  });
}
