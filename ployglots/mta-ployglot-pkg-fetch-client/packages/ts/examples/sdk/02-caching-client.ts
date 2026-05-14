// @ts-nocheck
/**
 * Example: cached client via `CachingClient`.
 *
 * `CachingClient` wraps an `AsyncClient` with a `CacheManager` so repeated GETs
 * for the same URL are served from memory. The `cache.stats()` accessor reports
 * cumulative `hits` / `misses` / `evictions` / `size`.
 */
import { CachingClient } from '@polyglot/fetch-http-client';

async function main(): Promise<void> {
  const client = new CachingClient({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    cache: { ttl: 60_000 }, // 60s in-memory TTL
  });
  try {
    // First call: cache miss → network.
    await client.get('/posts/1');
    // Second call: cache hit → no network.
    await client.get('/posts/1');

    const stats = client.cache.stats();
    console.log('cache hits:', stats.hits);
    console.log('cache misses:', stats.misses);
    console.log('cache size:', stats.size);
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
