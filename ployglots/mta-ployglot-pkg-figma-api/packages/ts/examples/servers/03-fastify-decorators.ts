// @ts-nocheck
/**
 * Server pattern #3 — Fastify **decorators**.
 *
 * Rather than attaching the SDK to every request in `preHandler`,
 * decorate at the server level (`fastify.decorate`) for per-instance
 * values and at the request level (`fastify.decorateRequest`) for
 * per-request factories. Decorators are the idiomatic way to extend
 * the Fastify surface.
 *
 * The pattern here:
 *
 *   - `fastify.figmaClient`         — one shared AsyncClient.
 *   - `fastify.createFigmaFor(req)` — factory that returns a
 *     request-scoped FigmaClient with overrides (e.g. user-specific
 *     token, per-tenant proxy). Use when your service is a multi-
 *     tenant facade in front of Figma.
 *
 * Run:
 *   FIGMA_PASS=$TOKEN npx tsx examples/servers/03-fastify-decorators.ts
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { FigmaClient, type FigmaClientOptions } from '@polyglot/figma-api';

declare module 'fastify' {
  interface FastifyInstance {
    figmaClient: FigmaClient;
    createFigmaFor(req: FastifyRequest): FigmaClient;
  }
}

async function main() {
  const fastifyImport = await import('fastify');
  const app = fastifyImport.default({ logger: true });

  // Shared long-lived client.
  const shared = new FigmaClient({ proxy: {} });
  app.decorate('figmaClient', shared);

  // Request-scoped factory — returns a client configured for the
  // caller's token, but reuses the shared AsyncClient's transport
  // when the header matches the default (so we pay no extra
  // socket-pool cost for the common case).
  app.decorate('createFigmaFor', (req: FastifyRequest) => {
    const bearer = req.headers['x-caller-figma-token'];
    if (typeof bearer === 'string' && bearer.length > 0 && bearer !== shared.config.token) {
      const options: FigmaClientOptions = { token: bearer, proxy: {} };
      return new FigmaClient(options);
    }
    return shared;
  });

  app.addHook('onClose', async () => {
    await shared.close();
  });

  app.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const client = app.createFigmaFor(req);
    try {
      return await client.me.get();
    } finally {
      // Only close the caller-specific client. The shared one stays.
      if (client !== shared) await client.close();
    }
  });

  await app.listen({ port: 3002 });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`Example failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
