export default async function confluenceRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/wiki/rest/api/user/current", async (request, reply) => {
    const client = await request.fetchClient("confluence");
    try {
      const upstream = await client.get("/wiki/rest/api/user/current");
      if (upstream.status_code >= 400) {
        const body = await upstream.text();
        return reply.code(502).send({
          service: "confluence",
          connected: false,
          upstream_status: upstream.status_code,
          upstream_body: body.slice(0, 512),
        });
      }
      const data = await upstream.json();
      return {
        service: "confluence",
        connected: true,
        host: process.env.CONFLUENCE_BASE_URL,
        data,
      };
    } catch (err) {
      return reply.code(502).send({ service: "confluence", connected: false, error: err.message });
    }
  });
}
