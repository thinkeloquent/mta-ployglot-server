import { getConfig } from "@ployglot/app-yaml-fetch-config";
import { buildEcho } from "../lifecycles/_provider_config_echo.mjs";

export default async function statsigRoutes(fastify, _config) {
  fastify.get("/healthz/integrations/statsig/gates", async (request, reply) => {
    const cfg = getConfig();
    const host = cfg?.providers?.statsig?.base_url ?? "";
    let config_used = null;
    try {
      config_used = await buildEcho({
        provider: "statsig",
        request,
        cfg,
        resolver: request.runtime_template_resolver,
        trigger: "OnRequest",
      });
    } catch {
      config_used = null;
    }
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
          config_used,
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
        host,
        count: gates.length,
        gates,
        config_used,
      };
    } catch (err) {
      return reply.code(502).send({
        service: "statsig",
        connected: false,
        error: err.message,
        config_used,
      });
    }
  });
}
