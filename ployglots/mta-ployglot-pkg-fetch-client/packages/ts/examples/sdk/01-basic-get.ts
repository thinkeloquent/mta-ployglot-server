// @ts-nocheck
/**
 * Example: minimal SDK usage.
 *
 * `createSDK({ baseUrl })` returns an SDK that owns its own retry loop and
 * (optionally) circuit breaker. Verb methods return a typed `SDKResponse<T>`
 * with `.success`, `.statusCode`, `.data`, `.error`, `.headers`, `.duration`.
 */
import { createSDK } from '@polyglot/fetch-http-client/sdk';

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

async function main(): Promise<void> {
  const sdk = createSDK({ baseUrl: 'https://jsonplaceholder.typicode.com' });
  try {
    const result = await sdk.get<Post>('/posts/1');
    console.log('success:', result.success);
    console.log('status:', result.statusCode);
    console.log('duration(ms):', result.duration);
    console.log('data:', result.data);
  } finally {
    await sdk.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
