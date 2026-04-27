export default async function figmaRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/figma/me", async (request, reply) => {
    const client = await request.fetchClient("figma");
    try {
      const upstream = await client.get("/v1/me");
      if (upstream.status_code >= 400) {
        const body = await upstream.text();
        return reply.code(502).send({
          service: "figma",
          connected: false,
          upstream_status: upstream.status_code,
          upstream_body: body.slice(0, 512),
        });
      }
      const data = await upstream.json();
      return {
        service: "figma",
        connected: true,
        host: process.env.FIGMA_API_BASE_URL ?? "https://api.figma.com",
        data,
      };
    } catch (err) {
      return reply.code(502).send({ service: "figma", connected: false, error: err.message });
    }
  });
}
