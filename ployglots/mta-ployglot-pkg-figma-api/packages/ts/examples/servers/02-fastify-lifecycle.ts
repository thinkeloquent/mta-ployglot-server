// @ts-nocheck
/**
 * Server pattern #2 — Fastify **lifecycle hooks**.
 *
 * Wires FigmaClient to the server's request/response lifecycle:
 *
 *   - `onReady`      construct the SDK once app boot is complete.
 *   - `preHandler`   attach a request-scoped client with per-request
 *                    timeouts, headers, or logger context.
 *   - `onResponse`   attach a response hook for metrics / tracing.
 *   - `onClose`      graceful shutdown → `client.close()`.
 *
 * Compared to the plugin pattern: here you keep one long-lived
 * AsyncClient but push per-request context through the request
 * object rather than through a decorator.
 *
 * Run:
 *   FIGMA_PASS=$TOKEN npx tsx examples/servers/02-fastify-lifecycle.ts
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { FigmaClient } from '@polyglot/figma-api';

async function main() {
  const fastifyImport = await import('fastify');
  const app = fastifyImport.default({ logger: true });

  let figma: FigmaClient | null = null;

  // 1. onReady — one-time construction after all plugins registered.
  app.addHook('onReady', async () => {
    figma = new FigmaClient({ proxy: {} });
    app.log.info({ msg: 'FigmaClient constructed' });
  });

  // 2. preHandler — per-request context. Here we stash the client
  //    on the request so handlers can access it without a module
  //    import.
  app.addHook('preHandler', async (req: FastifyRequest, _reply: FastifyReply) => {
    (req as FastifyRequest & { figma: FigmaClient }).figma = figma!;
  });

  // 3. onResponse — after every response, log upstream-relevant info.
  app.addHook('onResponse', async (req, reply) => {
    app.log.info({
      url: req.url,
      status: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  // 4. onClose — graceful shutdown.
  app.addHook('onClose', async () => {
    await figma?.close();
  });

  app.get('/me', async (req) => {
    const client = (req as FastifyRequest & { figma: FigmaClient }).figma;
    return await client.me.get();
  });

  await app.listen({ port: 3001 });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`Example failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
