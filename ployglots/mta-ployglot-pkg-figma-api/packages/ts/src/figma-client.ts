// @ts-nocheck
/**
 * `FigmaClient` — the top-level SDK entry point.
 *
 * Composes the FetchClient contract with domain sub-SDKs. Accepts
 * either the default (token + proxy + env-driven) fetch client, or a
 * BYO one produced by `fetchClientFromPolyglot(outer)` for composed
 * retry / caching / circuit-breaker topologies.
 */

import { resolveFigmaConfig, type FigmaConfig, type FigmaConfigInput } from './config.js';
import { FigmaError, mapHttpError } from './errors.js';
import {
  createDefaultFetchClient,
  type FetchClient,
  type FetchRequestOptions,
} from './fetch-client.js';
import { createLogger, type Logger } from './logger.js';
import { CommentsResource } from './resources/comments.js';
import { ComponentsResource } from './resources/components.js';
import { DevResourcesResource } from './resources/dev-resources.js';
import { FilesResource } from './resources/files.js';
import { LibraryAnalyticsResource } from './resources/library-analytics.js';
import { MeResource } from './resources/me.js';
import { ProjectsResource } from './resources/projects.js';
import { VariablesResource } from './resources/variables.js';
import { WebhooksResource } from './resources/webhooks.js';

export interface FigmaClientOptions extends FigmaConfigInput {
  /** Pre-built FetchClient to bypass the default transport. */
  fetchClient?: FetchClient;
  logger?: Logger;
}

export class FigmaClient {
  readonly config: FigmaConfig;
  readonly fetchClient: FetchClient;
  readonly logger: Logger;

  readonly me: MeResource;
  readonly files: FilesResource;
  readonly comments: CommentsResource;
  readonly projects: ProjectsResource;
  readonly components: ComponentsResource;
  readonly variables: VariablesResource;
  readonly devResources: DevResourcesResource;
  readonly libraryAnalytics: LibraryAnalyticsResource;
  readonly webhooks: WebhooksResource;

  constructor(options: FigmaClientOptions = {}) {
    this.config = resolveFigmaConfig(options);
    this.fetchClient = options.fetchClient ?? createDefaultFetchClient(this.config);
    this.logger = options.logger ?? createLogger({ prefix: 'figma-api' });

    this.me = new MeResource(this);
    this.files = new FilesResource(this);
    this.comments = new CommentsResource(this);
    this.projects = new ProjectsResource(this);
    this.components = new ComponentsResource(this);
    this.variables = new VariablesResource(this);
    this.devResources = new DevResourcesResource(this);
    this.libraryAnalytics = new LibraryAnalyticsResource(this);
    this.webhooks = new WebhooksResource(this);
  }

  /**
   * Low-level GET helper used by every resource. Centralises error
   * mapping so subclasses stay free of HTTP concerns.
   */
  async get<T>(path: string, options: FetchRequestOptions = {}): Promise<T> {
    return this._request<T>('GET', path, options);
  }

  async post<T>(path: string, options: FetchRequestOptions = {}): Promise<T> {
    return this._request<T>('POST', path, options);
  }

  async delete<T>(path: string, options: FetchRequestOptions = {}): Promise<T> {
    return this._request<T>('DELETE', path, options, true);
  }

  private async _request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: FetchRequestOptions,
    allowEmpty = false,
  ): Promise<T> {
    const verb =
      method === 'GET'
        ? this.fetchClient.get.bind(this.fetchClient)
        : method === 'POST'
          ? this.fetchClient.post.bind(this.fetchClient)
          : this.fetchClient.delete.bind(this.fetchClient);
    const resp = await verb(path, options);
    const status = statusOf(resp);
    if (status >= 400) {
      const body = await safeText(resp);
      throw mapHttpError({
        method,
        url: path,
        status,
        body,
        retryAfter: headerOf(resp, 'retry-after'),
      });
    }
    try {
      return (await resp.json()) as T;
    } catch (err) {
      if (allowEmpty) return undefined as unknown as T;
      throw new FigmaError(`${method} ${path} → failed to decode JSON`, { cause: err });
    }
  }

  async close(): Promise<void> {
    await this.fetchClient.close();
  }
}

async function safeText(resp: { text?: () => Promise<string> }): Promise<string> {
  try {
    return (await resp.text?.()) ?? '';
  } catch {
    return '';
  }
}

/**
 * Read the HTTP status off a response. Handles both the fetch-http-client
 * `Response` (`.statusCode`) and the fetch-style `.status` getter — the
 * fake test client uses the latter and we want both to work.
 */
function statusOf(resp: unknown): number {
  const r = resp as { statusCode?: number; status?: number };
  return r.statusCode ?? r.status ?? 0;
}

function headerOf(resp: unknown, name: string): string | null {
  const r = resp as { headers?: { get?: (n: string) => string | null | undefined } };
  return r.headers?.get?.(name) ?? null;
}
