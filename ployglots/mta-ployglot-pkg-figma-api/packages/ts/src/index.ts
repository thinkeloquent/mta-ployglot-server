// @ts-nocheck
/**
 * @polyglot/figma-api — Figma REST API client on top of
 * @polyglot/fetch-http-client.
 *
 * Public surface:
 *   - FigmaClient               — main SDK entry point
 *   - createFigmaFetchClient    — build a standalone FetchClient
 *   - fetchClientFromPolyglot   — wrap a user AsyncClient as a FetchClient (BYO)
 *   - resolveFigmaConfig        — env + explicit option merge
 *   - buildProxy                — proxy helper (auto-detects from env)
 *   - FigmaError + subclasses   — typed error tree
 *   - VERSION                   — package version constant
 */

export { FigmaClient } from './figma-client.js';
export type { FigmaClientOptions } from './figma-client.js';

export {
  createFigmaFetchClient,
  createDefaultFetchClient,
  fetchClientFromPolyglot,
} from './fetch-client.js';
export type { FetchClient, FetchRequestOptions } from './fetch-client.js';

export { resolveFigmaConfig, DEFAULT_FIGMA_HOST } from './config.js';
export type { FigmaConfig, FigmaConfigInput } from './config.js';

export { buildProxy, optionalEnv, requireEnv } from './proxy.js';
export type { ProxyOptionsBag } from './proxy.js';

export {
  FigmaError,
  FigmaConfigError,
  FigmaAuthError,
  FigmaNotFoundError,
  FigmaRateLimitError,
  FigmaServerError,
  FigmaTransportError,
  mapHttpError,
} from './errors.js';
export type { FigmaErrorContext } from './errors.js';

export { createLogger, maskToken } from './logger.js';
export type { Logger, LoggerOptions, LogLevel } from './logger.js';

export { FIGMA_DEFAULT_RETRY, buildFigmaRetryConfig } from './retry.js';
export type { FigmaRetryInput, BuildFigmaRetryOptions } from './retry.js';

export { MeResource } from './resources/me.js';
export { FilesResource } from './resources/files.js';
export { CommentsResource } from './resources/comments.js';
export { ProjectsResource } from './resources/projects.js';
export { ComponentsResource } from './resources/components.js';
export { VariablesResource } from './resources/variables.js';
export { DevResourcesResource } from './resources/dev-resources.js';
export { LibraryAnalyticsResource } from './resources/library-analytics.js';
export { WebhooksResource } from './resources/webhooks.js';
export type { TeamPageParams } from './resources/components.js';
export type { VariablesPublishRequest } from './resources/variables.js';
export type { DevResourceCreateItem, DevResourceUpdateItem } from './resources/dev-resources.js';
export type { AnalyticsGroupBy, AnalyticsQueryParams } from './resources/library-analytics.js';
export type {
  WebhookCreateRequest,
  WebhookEvent,
  WebhookUpdateRequest,
} from './resources/webhooks.js';
export type {
  FigmaUser,
  FigmaFile,
  FigmaFileRequestOptions,
  FigmaComment,
  FigmaCommentsResponse,
  FigmaProject,
  FigmaProjectFile,
  FigmaProjectFilesResponse,
  FigmaTeamProjectsResponse,
} from './resources/types.js';

export { VERSION } from './version.js';
