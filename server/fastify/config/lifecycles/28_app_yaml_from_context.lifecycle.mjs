import fp from "fastify-plugin";
import { applyOverwritesFromContext } from "@ployglot/app-yaml-from-context";

async function applierPlugin(fastify, _opts) {
  if (!fastify.runtime_template_resolver) {
    throw new Error(
      "runtime_template_resolver missing — confirm 26_runtime_template_resolver.lifecycle.mjs runs before 28"
    );
  }
  const resolver = fastify.runtime_template_resolver;
  const applier = (cfg, context = {}) =>
    applyOverwritesFromContext(cfg, { resolver, context });

  fastify.decorate("app_yaml_applier", applier);
  fastify.decorateRequest("app_yaml_applier", null);
  fastify.addHook("onRequest", async (req) => {
    req.app_yaml_applier = applier;
  });
}

const wrapped = fp(applierPlugin, {
  name: "app-yaml-from-context",
  fastify: ">=4",
  dependencies: ["runtime-template-resolver"],
});

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
  server.log.info("app-yaml-from-context decorator registered");
}
