// @ts-nocheck
/**
 * Server pattern #1 — Fastify **plugin** (encapsulation).
 *
 * Wraps `FigmaClient` in a dedicated Fastify plugin so every route
 * registered under the plugin scope gets a shared SDK instance.
 * Scope rules:
 *
 *   - The plugin owns the client's lifecycle: it creates it on
 *     plugin registration, closes it on `onClose`.
 *   - Child routes reach the SDK via `fastify.figma` (see `decorate`).
 *   - Downstream plugins registered INSIDE this scope see the client;
 *     plugins registered as siblings do not (Fastify encapsulation).
 *
 * Install the example deps in a scratch project:
 *   npm i fastify @polyglot/figma-api
 *
 * Run:
 *   FIGMA_PASS=$TOKEN npx tsx examples/servers/01-fastify-plugin.ts
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { FigmaClient, type FigmaClientOptions } from '@polyglot/figma-api';

declare module 'fastify' {
  interface FastifyInstance {
    figma: FigmaClient;
  }
}

/**
 * Plugin factory — returns a Fastify plugin that owns the SDK
 * instance for the lifetime of the enclosing scope.
 */
export function figmaPlugin(
  options: FigmaClientOptions = {},
): FastifyPluginAsync<FigmaClientOptions> {
  const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    const client = new FigmaClient(options);
    fastify.decorate('figma', client);
    fastify.addHook('onClose', async () => {
      await client.close();
    });
  };
  // `fastify-plugin` breaks encapsulation so `fastify.figma` is visible
  // to sibling routes in the same scope. Wrap in a named plugin for
  // clearer error traces.
  return fastifyPlugin(plugin, {
    name: '@polyglot/figma-api-plugin',
    fastify: '4.x',
  });
}

/* ----- Example app wiring the plugin ----- */

async function main() {
  const fastifyImport = await import('fastify');
  const app = fastifyImport.default({ logger: true });

  await app.register(figmaPlugin({ proxy: {} }));

  app.get('/me', async () => {
    return await app.figma.me.get();
  });

  app.get('/files/:key', async (req) => {
    const { key } = req.params as { key: string };
    return await app.figma.files.get(key, { depth: 1 });
  });

  await app.listen({ port: 3000 });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`Example failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
