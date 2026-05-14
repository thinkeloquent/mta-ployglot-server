// @ts-nocheck
/**
 * Dev Resources — Figma REST API coverage.
 *
 * Tier: basic. Dev Mode resources link a node to an external URL
 * (Jira ticket, Storybook page, etc.).
 */

import type { FigmaClient } from '../figma-client.js';

export interface DevResourceCreateItem {
  name: string;
  url: string;
  file_key: string;
  node_id: string;
}

export interface DevResourceUpdateItem {
  id: string;
  name?: string;
  url?: string;
}

export class DevResourcesResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/files/:file_key/dev_resources — dev resources scoped to a file. */
  async list(fileKey: string, nodeIds?: string[]): Promise<unknown> {
    const params: Record<string, string> = {};
    if (nodeIds && nodeIds.length > 0) params.node_ids = nodeIds.join(',');
    return this.client.get(`/v1/files/${encodeURIComponent(fileKey)}/dev_resources`, {
      params,
    });
  }

  /** POST /v1/dev_resources — bulk-create dev resources. */
  async create(items: DevResourceCreateItem[]): Promise<unknown> {
    return this.client.post('/v1/dev_resources', { body: { dev_resources: items } });
  }

  /** PUT /v1/dev_resources — bulk-update dev resources. */
  async update(items: DevResourceUpdateItem[]): Promise<unknown> {
    return this.client.post('/v1/dev_resources', { body: { dev_resources: items } });
  }

  /** DELETE /v1/files/:file_key/dev_resources/:id — delete one. */
  async delete(fileKey: string, devResourceId: string): Promise<void> {
    await this.client.delete<void>(
      `/v1/files/${encodeURIComponent(fileKey)}/dev_resources/${encodeURIComponent(devResourceId)}`,
    );
  }
}
