export default async function githubRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/github/user", async (request, reply) => {
    const client = await request.fetchClient("github");
    try {
      const upstream = await client.get("/user");
      if (upstream.status_code >= 400) {
        const body = await upstream.text();
        return reply.code(502).send({
          service: "github",
          connected: false,
          upstream_status: upstream.status_code,
          upstream_body: body.slice(0, 512),
        });
      }
      const data = await upstream.json();
      return {
        service: "github",
        connected: true,
        host: process.env.GITHUB_API_BASE_URL ?? "https://api.github.com",
        data,
      };
    } catch (err) {
      return reply.code(502).send({ service: "github", connected: false, error: err.message });
    }
  });
}
