export default async function saucelabsRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/saucelabs/rest/v1/user", async (request, reply) => {
    const user = process.env.SAUCE_USERNAME;
    if (!user) {
      return reply
        .code(502)
        .send({ service: "saucelabs", connected: false, error: "Missing env SAUCE_USERNAME" });
    }
    const client = await request.fetchClient("saucelabs");
    try {
      const upstream = await client.get(
        `/rest/v1/users/${encodeURIComponent(user)}/concurrency`,
      );
      if (upstream.status_code >= 400) {
        const body = await upstream.text();
        return reply.code(502).send({
          service: "saucelabs",
          connected: false,
          upstream_status: upstream.status_code,
          upstream_body: body.slice(0, 512),
        });
      }
      const data = await upstream.json();
      return {
        service: "saucelabs",
        connected: true,
        host: process.env.SAUCELABS_BASE_URL ?? "https://api.us-west-1.saucelabs.com",
        user,
        org_vms: data?.concurrency?.organization?.allowed?.vms ?? null,
        team_vms: data?.concurrency?.team?.allowed?.vms ?? null,
      };
    } catch (err) {
      return reply.code(502).send({ service: "saucelabs", connected: false, error: err.message });
    }
  });
}
