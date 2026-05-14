// @ts-nocheck
/**
 * Components / Component Sets / Styles — Figma REST API coverage.
 *
 * Covers the 3 library-object types under one resource. Each type
 * exposes the same 3 endpoints: list-by-team, list-by-file, get-by-key.
 *
 * Tier: basic (published components/styles are accessible to anyone
 * with the PAT; enterprise-only analytics are under LibraryAnalytics).
 */

import type { FigmaClient } from '../figma-client.js';

export interface TeamPageParams {
  page_size?: number;
  after?: string | number;
  before?: string | number;
}

function pageParams(p: TeamPageParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (p.page_size !== undefined) out.page_size = p.page_size;
  if (p.after !== undefined) out.after = p.after;
  if (p.before !== undefined) out.before = p.before;
  return out;
}

export class ComponentsResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/teams/:team_id/components — published components for a team. */
  async listForTeam(teamId: string, params: TeamPageParams = {}): Promise<unknown> {
    return this.client.get(`/v1/teams/${encodeURIComponent(teamId)}/components`, {
      params: pageParams(params),
    });
  }

  /** GET /v1/files/:key/components — components defined inside a single file. */
  async listForFile(fileKey: string): Promise<unknown> {
    return this.client.get(`/v1/files/${encodeURIComponent(fileKey)}/components`);
  }

  /** GET /v1/components/:key — fetch a single published component by key. */
  async get(componentKey: string): Promise<unknown> {
    return this.client.get(`/v1/components/${encodeURIComponent(componentKey)}`);
  }

  /** GET /v1/teams/:team_id/component_sets — published component sets. */
  async listComponentSetsForTeam(teamId: string, params: TeamPageParams = {}): Promise<unknown> {
    return this.client.get(`/v1/teams/${encodeURIComponent(teamId)}/component_sets`, {
      params: pageParams(params),
    });
  }

  /** GET /v1/files/:key/component_sets — component sets inside a file. */
  async listComponentSetsForFile(fileKey: string): Promise<unknown> {
    return this.client.get(`/v1/files/${encodeURIComponent(fileKey)}/component_sets`);
  }

  /** GET /v1/component_sets/:key — single component set. */
  async getComponentSet(setKey: string): Promise<unknown> {
    return this.client.get(`/v1/component_sets/${encodeURIComponent(setKey)}`);
  }

  /** GET /v1/teams/:team_id/styles — published styles (color/text/effect/grid). */
  async listStylesForTeam(teamId: string, params: TeamPageParams = {}): Promise<unknown> {
    return this.client.get(`/v1/teams/${encodeURIComponent(teamId)}/styles`, {
      params: pageParams(params),
    });
  }

  /** GET /v1/files/:key/styles — styles inside a single file. */
  async listStylesForFile(fileKey: string): Promise<unknown> {
    return this.client.get(`/v1/files/${encodeURIComponent(fileKey)}/styles`);
  }

  /** GET /v1/styles/:key — single style. */
  async getStyle(styleKey: string): Promise<unknown> {
    return this.client.get(`/v1/styles/${encodeURIComponent(styleKey)}`);
  }
}
