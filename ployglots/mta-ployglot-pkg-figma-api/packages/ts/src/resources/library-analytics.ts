// @ts-nocheck
/**
 * Library Analytics — Figma REST API coverage.
 *
 * Tier: **enterprise only**. Returns 403 without an Enterprise/Org
 * plan. All endpoints are read-only and paginated via `cursor`.
 */

import type { FigmaClient } from '../figma-client.js';

export type AnalyticsGroupBy = 'component' | 'team' | 'file' | 'style' | 'variable';

export interface AnalyticsQueryParams {
  group_by: AnalyticsGroupBy;
  cursor?: string;
  order?: 'asc' | 'desc';
  // For date-bounded endpoints.
  start_date?: string;
  end_date?: string;
}

function flatten(params: AnalyticsQueryParams): Record<string, string> {
  const out: Record<string, string> = { group_by: params.group_by };
  if (params.cursor !== undefined) out.cursor = params.cursor;
  if (params.order !== undefined) out.order = params.order;
  if (params.start_date !== undefined) out.start_date = params.start_date;
  if (params.end_date !== undefined) out.end_date = params.end_date;
  return out;
}

export class LibraryAnalyticsResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/analytics/libraries/:file_key/component/actions */
  async componentActions(fileKey: string, params: AnalyticsQueryParams): Promise<unknown> {
    return this.client.get(
      `/v1/analytics/libraries/${encodeURIComponent(fileKey)}/component/actions`,
      { params: flatten(params) },
    );
  }

  /** GET /v1/analytics/libraries/:file_key/component/usages */
  async componentUsages(fileKey: string, params: AnalyticsQueryParams): Promise<unknown> {
    return this.client.get(
      `/v1/analytics/libraries/${encodeURIComponent(fileKey)}/component/usages`,
      { params: flatten(params) },
    );
  }

  /** GET /v1/analytics/libraries/:file_key/style/actions */
  async styleActions(fileKey: string, params: AnalyticsQueryParams): Promise<unknown> {
    return this.client.get(`/v1/analytics/libraries/${encodeURIComponent(fileKey)}/style/actions`, {
      params: flatten(params),
    });
  }

  /** GET /v1/analytics/libraries/:file_key/style/usages */
  async styleUsages(fileKey: string, params: AnalyticsQueryParams): Promise<unknown> {
    return this.client.get(`/v1/analytics/libraries/${encodeURIComponent(fileKey)}/style/usages`, {
      params: flatten(params),
    });
  }

  /** GET /v1/analytics/libraries/:file_key/variable/actions */
  async variableActions(fileKey: string, params: AnalyticsQueryParams): Promise<unknown> {
    return this.client.get(
      `/v1/analytics/libraries/${encodeURIComponent(fileKey)}/variable/actions`,
      { params: flatten(params) },
    );
  }

  /** GET /v1/analytics/libraries/:file_key/variable/usages */
  async variableUsages(fileKey: string, params: AnalyticsQueryParams): Promise<unknown> {
    return this.client.get(
      `/v1/analytics/libraries/${encodeURIComponent(fileKey)}/variable/usages`,
      { params: flatten(params) },
    );
  }
}
