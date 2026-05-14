// @ts-nocheck
import type { FigmaClient } from '../figma-client.js';
import type { FigmaUser } from './types.js';

export class MeResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/me — authenticated user. */
  async get(): Promise<FigmaUser> {
    return this.client.get<FigmaUser>('/v1/me');
  }
}
