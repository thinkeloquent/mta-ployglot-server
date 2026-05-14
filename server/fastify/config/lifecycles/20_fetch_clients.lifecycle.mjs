import fp from "fastify-plugin";
import { createRegistry } from "./_fetch_registry.mjs";

async function fetchClientsPlugin(fastify, _opts) {
  const registry = createRegistry(fastify.log);
  fastify.decorate("fetchClients", registry);

  fastify.decorateRequest("fetchClient", null);
  fastify.addHook("onRequest", async (req) => {
    req.fetchClient = async function (name) {
      if (!(name in registry)) {
        const valid = Object.keys(registry).join("|");
        throw new Error(`unknown fetchClient: ${name}; valid: ${valid}`);
      }
      return await registry[name];
    };
  });

  fastify.addHook("onClose", async () => {
    for (const [name, promise] of registry._constructed) {
      try {
        const client = await promise;
        await client.close();
      } catch (err) {
        fastify.log.warn(
          { provider: name, err: err?.message },
          "fetch-client close failed",
        );
      }
    }
  });
}

const wrapped = fp(fetchClientsPlugin, {
  name: "fetch-clients",
  fastify: ">=4",
});

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
}
