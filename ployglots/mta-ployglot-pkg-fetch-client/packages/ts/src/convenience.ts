// @ts-nocheck
import logger from './logger.js';
import { AsyncClient } from './client/client.js';
import type { RequestOptions } from './client/options.js';
import type { Response } from './models/response.js';

const log = logger.create('@polyglot/fetch-http-client', 'convenience.ts');

let defaultClient: AsyncClient | null = null;
let beforeExitHandlerRegistered = false;

function getDefaultClient(): AsyncClient {
  if (defaultClient === null) {
    defaultClient = new AsyncClient({ followRedirects: true, maxRedirects: 10 });
    if (!beforeExitHandlerRegistered) {
      beforeExitHandlerRegistered = true;
      process.on('beforeExit', () => {
        if (defaultClient !== null) {
          defaultClient.close().catch(() => {
            /* swallow */
          });
        }
      });
    }
    log.debug('Default client created');
  }
  return defaultClient;
}

export async function closeDefaultClient(): Promise<void> {
  if (defaultClient !== null) {
    const c = defaultClient;
    defaultClient = null;
    await c.close();
  }
}

export async function get(url: string | URL, options?: RequestOptions): Promise<Response> {
  return getDefaultClient().get(url, options);
}
export async function post(url: string | URL, options?: RequestOptions): Promise<Response> {
  return getDefaultClient().post(url, options);
}
export async function put(url: string | URL, options?: RequestOptions): Promise<Response> {
  return getDefaultClient().put(url, options);
}
export async function patch(url: string | URL, options?: RequestOptions): Promise<Response> {
  return getDefaultClient().patch(url, options);
}
export async function del(url: string | URL, options?: RequestOptions): Promise<Response> {
  return getDefaultClient().delete(url, options);
}
export { del as delete };
export async function head(url: string | URL, options?: RequestOptions): Promise<Response> {
  return getDefaultClient().head(url, options);
}
export async function options(url: string | URL, reqOptions?: RequestOptions): Promise<Response> {
  return getDefaultClient().options(url, reqOptions);
}
export async function request(
  method: string,
  url: string | URL,
  reqOptions?: RequestOptions,
): Promise<Response> {
  return getDefaultClient().request(method, url, reqOptions);
}
