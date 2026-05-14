import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  setup,
  createFastifyAdapter,
  environmentAddon,
  lifecycleAddon,
  routeAddon,
} from "../../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname);

const config = {
  title: "fastify_server",
  port: Number(process.env.PORT ?? 51000),
  host: process.env.HOST ?? "0.0.0.0",
  profile: process.env.APP_ENV ?? "local",
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  paths: {
    environment: ["config/environment"],
    lifecycles: ["config/lifecycles"],
    routes: ["config/routes"],
  },
  initial_state: {
    build_id: process.env.BUILD_ID ?? "dev",
    build_version: process.env.BUILD_VERSION ?? "0.0.0",
  },
};

const adapter = createFastifyAdapter();
const addons = [environmentAddon, lifecycleAddon, routeAddon];

const server = await setup(adapter, addons, config, { baseDir: projectRoot });

try {
  await server.listen({ port: config.port, host: config.host });
  server.log.info(`fastify_server listening on http://${config.host}:${config.port}`);
} catch (err) {
  server.log.error({ err }, "failed to start");
  process.exit(1);
}
