export default async function jiraRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/jira/myself", async (request, reply) => {
    const client = await request.fetchClient("jira");
    try {
      const upstream = await client.get("/rest/api/3/myself");
      if (upstream.status_code >= 400) {
        const body = await upstream.text();
        return reply.code(502).send({
          service: "jira",
          connected: false,
          upstream_status: upstream.status_code,
          upstream_body: body.slice(0, 512),
        });
      }
      const data = await upstream.json();
      return {
        service: "jira",
        connected: true,
        host: process.env.JIRA_BASE_URL,
        data,
      };
    } catch (err) {
      return reply.code(502).send({ service: "jira", connected: false, error: err.message });
    }
  });
}
