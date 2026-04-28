import fp from "fastify-plugin";
import { AppYamlConfig, AppYamlConfigSDK } from "@ployglot/app-yaml-config";

async function appYamlConfigPlugin(fastify, _opts) {
  if (!fastify.app_yaml_loader) {
    throw new Error(
      "app_yaml_loader missing — confirm 25_app_yaml_loader.lifecycle.mjs runs before 27"
    );
  }
  const loaded = await fastify.app_yaml_loader.load_from_config_dir(undefined, {
    missing: "skip",
  });
  const config = await AppYamlConfig.initialize({ loaded });
  const sdk = new AppYamlConfigSDK(config);

  fastify.decorate("app_yaml_config", sdk);
  fastify.decorateRequest("app_yaml_config", null);
  fastify.addHook("onRequest", async (req) => {
    req.app_yaml_config = sdk;
  });
}

const wrapped = fp(appYamlConfigPlugin, {
  name: "app-yaml-config",
  fastify: ">=4",
  dependencies: ["app-yaml-loader"],
});

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
  server.log.info("app-yaml-config decorator registered");
}
