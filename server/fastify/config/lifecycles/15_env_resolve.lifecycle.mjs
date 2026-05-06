import fp from "fastify-plugin";
import {
  resolve,
  resolveBool,
  resolveFloat,
  resolveInt,
  TRUTHY_STRINGS,
} from "@org/env-resolve";

function makeResolver(boundConfig) {
  return {
    resolve: (arg, envKeys, configKey, defaultValue) =>
      resolve(arg, envKeys, boundConfig, configKey, defaultValue),
    resolveBool: (arg, envKeys, configKey, defaultValue) =>
      resolveBool(arg, envKeys, boundConfig, configKey, defaultValue),
    resolveInt: (arg, envKeys, configKey, defaultValue) =>
      resolveInt(arg, envKeys, boundConfig, configKey, defaultValue),
    resolveFloat: (arg, envKeys, configKey, defaultValue) =>
      resolveFloat(arg, envKeys, boundConfig, configKey, defaultValue),
    withConfig: (overrideConfig) => makeResolver(overrideConfig ?? boundConfig),
    TRUTHY_STRINGS,
  };
}

async function envResolvePlugin(fastify, opts) {
  const boundConfig = opts?.config ?? null;
  const resolver = makeResolver(boundConfig);

  fastify.decorate("envResolve", resolver);
  fastify.decorateRequest("envResolve", null);
  fastify.addHook("onRequest", async (req) => {
    req.envResolve = resolver;
  });
}

const wrapped = fp(envResolvePlugin, {
  name: "env-resolve",
  fastify: ">=4",
});

export default async function lifecycle(server, config) {
  await server.register(wrapped, { config: config ?? null });
  server.log.info("env-resolve decorator registered");
}
