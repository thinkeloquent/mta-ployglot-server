// @ts-nocheck
/**
 * Webhooks (v2) — Figma REST API coverage.
 *
 * Tier: basic. Webhook endpoints sit under `/v2/` (not `/v1/`).
 */

import type { FigmaClient } from '../figma-client.js';

export type WebhookEvent =
  | 'FILE_UPDATE'
  | 'FILE_VERSION_UPDATE'
  | 'FILE_DELETE'
  | 'LIBRARY_PUBLISH'
  | 'FILE_COMMENT'
  | 'DEV_MODE_STATUS_UPDATE';

export interface WebhookCreateRequest {
  event_type: WebhookEvent;
  team_id: string;
  endpoint: string;
  passcode: string;
  status?: 'ACTIVE' | 'PAUSED';
  description?: string;
}

export interface WebhookUpdateRequest {
  event_type?: WebhookEvent;
  endpoint?: string;
  passcode?: string;
  status?: 'ACTIVE' | 'PAUSED';
  description?: string;
}

export class WebhooksResource {
  constructor(private readonly client: FigmaClient) {}

  /** POST /v2/webhooks — create. */
  async create(body: WebhookCreateRequest): Promise<unknown> {
    return this.client.post('/v2/webhooks', { body });
  }

  /** GET /v2/webhooks/:id — fetch one. */
  async get(webhookId: string): Promise<unknown> {
    return this.client.get(`/v2/webhooks/${encodeURIComponent(webhookId)}`);
  }

  /** PUT /v2/webhooks/:id — update. */
  async update(webhookId: string, body: WebhookUpdateRequest): Promise<unknown> {
    return this.client.post(`/v2/webhooks/${encodeURIComponent(webhookId)}`, { body });
  }

  /** DELETE /v2/webhooks/:id — delete. */
  async delete(webhookId: string): Promise<void> {
    await this.client.delete<void>(`/v2/webhooks/${encodeURIComponent(webhookId)}`);
  }

  /** GET /v2/teams/:team_id/webhooks — all webhooks for a team. */
  async listForTeam(teamId: string): Promise<unknown> {
    return this.client.get(`/v2/teams/${encodeURIComponent(teamId)}/webhooks`);
  }

  /** GET /v2/webhooks/:id/requests — recent deliveries. */
  async requests(webhookId: string): Promise<unknown> {
    return this.client.get(`/v2/webhooks/${encodeURIComponent(webhookId)}/requests`);
  }
}
