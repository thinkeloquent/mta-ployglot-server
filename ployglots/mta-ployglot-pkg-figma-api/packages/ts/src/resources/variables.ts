// @ts-nocheck
/**
 * Variables — Figma REST API coverage.
 *
 * Tier: **enterprise only**. These endpoints return 403 without an
 * Enterprise/Org plan. `FigmaAuthError` surfaces that — read the
 * Figma docs for plan requirements.
 */

import type { FigmaClient } from '../figma-client.js';

export interface VariablesPublishRequest {
  variableCollections?: unknown[];
  variableModes?: unknown[];
  variables?: unknown[];
  variableModeValues?: unknown[];
}

export class VariablesResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/files/:file_key/variables/local — locally-defined variables. */
  async listLocal(fileKey: string): Promise<unknown> {
    return this.client.get(`/v1/files/${encodeURIComponent(fileKey)}/variables/local`);
  }

  /** GET /v1/files/:file_key/variables/published — published variables. */
  async listPublished(fileKey: string): Promise<unknown> {
    return this.client.get(`/v1/files/${encodeURIComponent(fileKey)}/variables/published`);
  }

  /**
   * POST /v1/files/:file_key/variables — upsert a batch of variables /
   * collections / modes. See Figma's variables API docs for the full
   * action shape (create / update / delete under one envelope).
   */
  async postVariables(fileKey: string, body: VariablesPublishRequest): Promise<unknown> {
    return this.client.post(`/v1/files/${encodeURIComponent(fileKey)}/variables`, { body });
  }
}
