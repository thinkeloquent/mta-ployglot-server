// @ts-nocheck
/**
 * Example: verb methods on a plain Client.
 *
 * Demonstrates: GET with query params, POST with JSON body, response.json<T>()
 * with a typed shape, and the `Client` alias re-exported as a synonym for
 * `AsyncClient`.
 */
import { Client } from '@polyglot/fetch-http-client';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

interface CreatedPost {
  id: number;
  title: string;
  body: string;
  userId: number;
}

async function main(): Promise<void> {
  const client = new Client({ baseUrl: 'https://jsonplaceholder.typicode.com' });
  try {
    const todoResp = await client.get('/todos/1', { params: { _limit: 1 } });
    const todo = await todoResp.json<Todo>();
    console.log('GET /todos/1 →', todo);

    const created = await client.post('/posts', {
      json: { title: 'hello', body: 'from fetch-http-client', userId: 1 },
    });
    const createdData = await created.json<CreatedPost>();
    console.log('POST /posts →', created.statusCode, createdData);
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
