import path from "node:path";
import fp from "fastify-plugin";
import { AppYamlConfig, AppYamlConfigSDK } from "@ployglot/app-yaml-config";

const EXTRA_CONFIG_FILES = Object.freeze([
  "database_schema.yaml",
  "llm_rag.yml",
  "vite.yaml",
]);

async function appYamlConfigPlugin(fastify, _opts) {
  if (!fastify.app_yaml_loader) {
    throw new Error(
      "app_yaml_loader missing — confirm 25_app_yaml_loader.lifecycle.mjs runs before 27"
    );
  }
  const loadedDefault = await fastify.app_yaml_loader.load_from_config_dir(
    undefined,
    { missing: "skip" }
  );
  const extraPaths = EXTRA_CONFIG_FILES.map((f) =>
    path.join(fastify.app_yaml_loader.config_dir, f)
  );
  const loadedExtra = await fastify.app_yaml_loader.load_files(extraPaths, {
    missing: "skip",
  });
  const loaded = new Map([
    ...loadedDefault.entries(),
    ...loadedExtra.entries(),
  ]);
  const config = await AppYamlConfig.initialize({ loaded });
  const sdk = new AppYamlConfigSDK(config);

  fastify.decorate("app_yaml_config", sdk);
  fastify.decorateRequest("app_yaml_config", null);
  fastify.addHook("onRequest", async (req) => {
    req.app_yaml_config = sdk;
  });

  fastify.log.info(
    { default: loadedDefault.size, extra: loadedExtra.size },
    "app-yaml-config decorator registered"
  );
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
