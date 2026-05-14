// @ts-nocheck
/**
 * Shared test helpers. Builds a fake `FetchClient` that matches the
 * contract FigmaClient consumes, so every unit test can assert the
 * exact path/params/body the client would have sent.
 */

import type { FetchClient, FetchRequestOptions } from '../src/fetch-client.js';

export interface RecordedCall {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  options: FetchRequestOptions;
}

export interface FakeResponse {
  status: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

export interface FakeFetchClient extends FetchClient {
  calls: RecordedCall[];
  closed: boolean;
}

export function createFakeFetchClient(
  responder: (call: RecordedCall) => FakeResponse,
): FakeFetchClient {
  const calls: RecordedCall[] = [];
  let closed = false;

  const makeResponse = (resp: FakeResponse) => ({
    status: resp.status,
    headers: {
      get: (name: string) => resp.headers?.[name.toLowerCase()] ?? null,
    },
    async json() {
      if (resp.body === undefined) throw new Error('no body');
      return resp.body;
    },
    async text() {
      if (resp.text !== undefined) return resp.text;
      if (resp.body !== undefined) return JSON.stringify(resp.body);
      return '';
    },
  });

  const verb = (method: RecordedCall['method']) => {
    return async (path: string, options: FetchRequestOptions = {}) => {
      const call: RecordedCall = { method, path, options };
      calls.push(call);
      return makeResponse(responder(call)) as never;
    };
  };

  return {
    calls,
    get closed() {
      return closed;
    },
    get: verb('GET'),
    post: verb('POST'),
    put: verb('PUT'),
    delete: verb('DELETE'),
    patch: verb('PATCH'),
    async close() {
      closed = true;
    },
  } as unknown as FakeFetchClient;
}
