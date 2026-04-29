import fp from "fastify-plugin";
import { createResolver, MissingStrategy } from "@ployglot/runtime-template-resolver";

async function resolverPlugin(fastify, _opts) {
  if (!fastify.envResolve) {
    throw new Error(
      "envResolve missing — confirm 15_env_resolve.lifecycle.mjs is loaded before 26_runtime_template_resolver"
    );
  }
  if (!fastify.compute_registry) {
    throw new Error(
      "compute_registry missing — confirm 24_compute_functions.lifecycle.mjs runs before 26_runtime_template_resolver"
    );
  }
  // IGNORE so unmatched {{app.X}} / {{request.X}} refs (no context at boot) become
  // literal strings rather than aborting. {{fn:…}} refs resolve via the registry.
  const resolver = createResolver({
    registry: fastify.compute_registry,
    missingStrategy: MissingStrategy.IGNORE,
  });

  fastify.decorate("runtime_template_resolver", resolver);
  fastify.decorateRequest("runtime_template_resolver", null);
  fastify.addHook("onRequest", async (req) => {
    req.runtime_template_resolver = resolver;
  });
}

const wrapped = fp(resolverPlugin, {
  name: "runtime-template-resolver",
  fastify: ">=4",
  dependencies: ["env-resolve", "compute-functions"],
});

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
  server.log.info("runtime-template-resolver decorator registered");
}
