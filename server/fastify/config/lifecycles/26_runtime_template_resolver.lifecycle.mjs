import fp from "fastify-plugin";
import { createResolver } from "@ployglot/runtime-template-resolver";

async function resolverPlugin(fastify, _opts) {
  if (!fastify.envResolve) {
    throw new Error(
      "envResolve missing — confirm 15_env_resolve.lifecycle.mjs is loaded before 26_runtime_template_resolver"
    );
  }
  const resolver = createResolver();

  fastify.decorate("runtime_template_resolver", resolver);
  fastify.decorateRequest("runtime_template_resolver", null);
  fastify.addHook("onRequest", async (req) => {
    req.runtime_template_resolver = resolver;
  });
}

const wrapped = fp(resolverPlugin, {
  name: "runtime-template-resolver",
  fastify: ">=4",
  dependencies: ["env-resolve"],
});

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
  server.log.info("runtime-template-resolver decorator registered");
}
