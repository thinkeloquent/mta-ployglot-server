// @ts-nocheck
/**
 * Example: event hooks for request-id propagation + response timing.
 *
 * Hooks fire in registration order; a hook that throws aborts the chain and
 * surfaces to the caller. Both `onRequest` and `onResponse` accept a single
 * function or an array of functions.
 */
import { AsyncClient, type Request, type Response } from '@polyglot/fetch-http-client';
import { randomUUID } from 'node:crypto';

async function main(): Promise<void> {
  const startTimes = new WeakMap<Request, number>();

  const client = new AsyncClient({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    eventHooks: {
      onRequest: [
        (req: Request) => {
          const id = randomUUID();
          req.headers.set('x-request-id', id);
          startTimes.set(req, Date.now());
          console.log('→', req.method, req.urlString, 'id=' + id);
        },
      ],
      onResponse: [
        (resp: Response) => {
          const start = resp.request ? startTimes.get(resp.request) : undefined;
          const elapsedMs = start !== undefined ? Date.now() - start : undefined;
          console.log(
            '←',
            resp.statusCode,
            elapsedMs !== undefined ? `in ${elapsedMs}ms` : '(elapsed unknown)',
          );
        },
      ],
    },
  });
  try {
    await client.get('/todos/1');
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
