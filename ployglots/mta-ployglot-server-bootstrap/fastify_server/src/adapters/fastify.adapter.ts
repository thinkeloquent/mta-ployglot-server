// @ts-nocheck
import Fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import closeWithGrace from "close-with-grace";
import { randomUUID } from "node:crypto";
import type { BootstrapConfig, HookFn, ResolvedBootstrapConfig } from "../contract/index.js";
import type { RuntimeAdapter, ScheduledHooks } from "./adapter.js";

export interface FastifyAdapterOptions {
  closeGraceMs?: number;
  requestIdHeader?: string;
  fastifyOptions?: Partial<FastifyServerOptions>;
}

export function createFastifyAdapter(
  options: FastifyAdapterOptions = {},
): RuntimeAdapter<FastifyInstance> {
  const closeGraceMs = options.closeGraceMs ?? 30_000;
  const requestIdHeader = options.requestIdHeader ?? "x-request-id";

  return {
    name: "fastify",

    createServer(config: ResolvedBootstrapConfig): FastifyInstance {
      const loggerOpts = config.logger ?? {};
      const level = loggerOpts.level ?? "info";
      const useJson = loggerOpts.json_format ?? process.env.NODE_ENV === "production";

      const serverOpts: FastifyServerOptions = {
        logger: useJson
          ? { level }
          : {
              level,
              transport: {
                target: "pino-pretty",
                options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
              },
            },
        requestIdHeader,
        genReqId: (req) => {
          const incoming = req.headers[requestIdHeader];
          if (typeof incoming === "string" && incoming.length > 0) return incoming;
          return randomUUID();
        },
        ...options.fastifyOptions,
      };

      const server = Fastify(serverOpts);
      return server;
    },

    decorate(server, key, value) {
      if (!server.hasDecorator(key)) {
        server.decorate(key, value);
      } else {
        (server as unknown as Record<string, unknown>)[key] = value;
      }
    },

    hasDecorator(server, key) {
      return server.hasDecorator(key);
    },

    onClose(server, fn) {
      server.addHook("onClose", async () => {
        await fn();
      });
    },

    attachRequestState(server, initialState) {
      if (!server.hasRequestDecorator("state")) {
        server.decorateRequest("state", null);
      }
      server.addHook("onRequest", async (req) => {
        (req as unknown as { state: Record<string, unknown> }).state = structuredClone(initialState);
      });
    },

    registerGracefulShutdown(server) {
      const closer = closeWithGrace({ delay: closeGraceMs }, async ({ err }) => {
        if (err) server.log.error({ err }, "close-with-grace caught error");
        await server.close();
      });
      server.addHook("onClose", async () => {
        closer.uninstall();
      });
    },

    scheduleHooks(
      server: FastifyInstance,
      hooks: ScheduledHooks<FastifyInstance>,
      config: ResolvedBootstrapConfig,
    ) {
      if (hooks.startup.length > 0) {
        server.addHook("onReady", async () => {
          for (const fn of hooks.startup) {
            const label = (fn as HookFn & { name?: string }).name || "anonymous";
            try {
              await fn(server, config);
              server.log.debug({ hook: label }, "startup hook complete");
            } catch (err) {
              server.log.error({ err, hook: label }, "startup hook failed");
            }
          }
        });
      }

      if (hooks.shutdown.length > 0) {
        server.addHook("onClose", async () => {
          for (const fn of hooks.shutdown) {
            const label = (fn as HookFn & { name?: string }).name || "anonymous";
            try {
              await fn(server, config);
              server.log.debug({ hook: label }, "shutdown hook complete");
            } catch (err) {
              server.log.error({ err, hook: label }, "shutdown hook failed");
            }
          }
        });
      }
    },

    async registerRoutes(
      server: FastifyInstance,
      fn: (s: FastifyInstance, c: BootstrapConfig) => void | Promise<void>,
    ) {
      await server.register(async (scope) => {
        await fn(scope, (server as unknown as { _config: BootstrapConfig })._config);
      });
    },
  };
}
