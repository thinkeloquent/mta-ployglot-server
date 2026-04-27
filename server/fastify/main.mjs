import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { appendFileSync, mkdirSync } from "node:fs";
import {
  setup,
  createFastifyAdapter,
  environmentAddon,
  lifecycleAddon,
  routeAddon,
} from "fastify-server";
import { setupRouteCollector, printRoutes } from "@mta/print-routes-fastify";

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

// Install the route collector before the route addon (priority 30) so the
// onRoute hook is in place when route files start registering. printRoutes
// reads this map; without it, it falls back to the radix-tree printer.
const routeCollectorAddon = {
  name: "route-collector",
  priority: 25,
  run: (s) => {
    setupRouteCollector(s);
    return {
      name: "route-collector",
      discovered: 0,
      validated: 0,
      imported: 0,
      registered: 0,
      skipped: 0,
      errors: [],
    };
  },
};

const addons = [environmentAddon, lifecycleAddon, routeCollectorAddon, routeAddon];

const server = await setup(adapter, addons, config, { baseDir: projectRoot });

server.addHook("onReady", async () => {
  printRoutes(server);
});

const logDir = process.env.LOG_DIR;
if (logDir) {
  mkdirSync(logDir, { recursive: true });
  const reqLogFile = resolve(logDir, "fastify.request.log");
  const errLogFile = resolve(logDir, "fastify.error.log");
  const appendJson = (file, obj) => {
    try {
      appendFileSync(file, JSON.stringify(obj) + "\n");
    } catch {}
  };
  server.addHook("onResponse", async (req, reply) => {
    appendJson(reqLogFile, {
      t: new Date().toISOString(),
      reqId: req.id,
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      rt_ms: Number(reply.elapsedTime?.toFixed?.(2) ?? reply.elapsedTime),
    });
  });
  server.addHook("onError", async (req, _reply, err) => {
    appendJson(errLogFile, {
      t: new Date().toISOString(),
      reqId: req.id,
      method: req.method,
      url: req.url,
      err: { message: err.message, stack: err.stack },
    });
  });
}

try {
  await server.listen({ port: config.port, host: config.host });
  server.log.info(`fastify_server listening on http://${config.host}:${config.port}`);
} catch (err) {
  server.log.error({ err }, "failed to start");
  process.exit(1);
}
