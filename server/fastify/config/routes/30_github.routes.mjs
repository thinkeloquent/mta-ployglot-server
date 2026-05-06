import { getConfig } from "@ployglot/app-yaml-fetch-config";
import { buildEcho } from "../lifecycles/_provider_config_echo.mjs";

export default async function githubRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/github/user", async (request, reply) => {
    const cfg = getConfig();
    const host = cfg?.providers?.github?.base_url ?? "";
    let config_used = null;
    try {
      config_used = await buildEcho({
        provider: "github",
        request,
        cfg,
        resolver: request.runtime_template_resolver,
        trigger: "OnRequest",
      });
    } catch {
      config_used = null;
    }
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
          config_used,
        });
      }
      const data = await upstream.json();
      return {
        service: "github",
        connected: true,
        host,
        data,
        config_used,
      };
    } catch (err) {
      return reply.code(502).send({
        service: "github",
        connected: false,
        error: err.message,
        config_used,
      });
    }
  });
}
