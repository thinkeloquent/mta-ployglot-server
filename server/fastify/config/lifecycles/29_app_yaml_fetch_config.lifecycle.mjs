import fp from "fastify-plugin";
import {
  EndpointConfigSDK,
  getEndpoint,
  getFetchConfig,
  listEndpoints,
  loadConfig,
  resolveIntent,
} from "@ployglot/app-yaml-fetch-config";

async function fetchConfigPlugin(fastify, _opts) {
  if (!fastify.app_yaml_config) {
    throw new Error(
      "app_yaml_config missing — confirm 27_app_yaml_config.lifecycle.mjs runs before 29"
    );
  }
  if (!fastify.app_yaml_applier) {
    throw new Error(
      "app_yaml_applier missing — confirm 28_app_yaml_from_context.lifecycle.mjs runs before 29"
    );
  }
  const merged = await fastify.app_yaml_applier(fastify.app_yaml_config.getAll());
  loadConfig(merged);

  // SDK gets the endpoint.dev.yaml path so refreshConfig() can re-read on demand
  // (slot 36 routes call sdk.refreshConfig()). Path source: APP_YAML_FIXTURES_DIR.
  const fixturesDir = process.env.APP_YAML_FIXTURES_DIR;
  const endpointFile = fixturesDir ? `${fixturesDir}/endpoint.dev.yaml` : null;
  const handle = {
    get_fetch_config: (intent, payload) => getFetchConfig(intent, payload ?? {}),
    list_endpoints: () => listEndpoints(),
    get_endpoint: (name) => getEndpoint(name),
    resolve_intent: (intent) => resolveIntent(intent),
    sdk: new EndpointConfigSDK({ filePath: endpointFile }),
  };

  fastify.decorate("app_yaml_fetch_config", handle);
  fastify.decorateRequest("app_yaml_fetch_config", null);
  fastify.addHook("onRequest", async (req) => {
    req.app_yaml_fetch_config = handle;
  });
}

const wrapped = fp(fetchConfigPlugin, {
  name: "app-yaml-fetch-config",
  fastify: ">=4",
  dependencies: ["app-yaml-config", "app-yaml-from-context"],
});

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
  server.log.info("app-yaml-fetch-config decorator registered");
}
