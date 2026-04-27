import {
  setup,
  createFastifyAdapter,
  environmentAddon,
  lifecycleAddon,
  routeAddon,
} from "fastify-server";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = resolve(__dirname, "..", "..");

export async function bootInProcess(extraEnv = {}) {
  Object.assign(process.env, extraEnv);
  const config = {
    title: "fastify_smoke",
    port: 0,
    host: "127.0.0.1",
    profile: "smoke",
    logger: { level: "warn" },
    paths: {
      environment: ["config/environment"],
      lifecycles: ["config/lifecycles"],
      routes: ["config/routes"],
    },
    initial_state: {},
  };
  const adapter = createFastifyAdapter();
  const server = await setup(
    adapter,
    [environmentAddon, lifecycleAddon, routeAddon],
    config,
    { baseDir: BASE_DIR },
  );
  await server.listen({ port: 0, host: "127.0.0.1" });
  const { port } = server.server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => server.close(),
  };
}
