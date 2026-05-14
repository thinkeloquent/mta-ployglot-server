// @ts-nocheck
import type { FigmaClient } from '../figma-client.js';
import type { FigmaComment, FigmaCommentsResponse } from './types.js';

export class CommentsResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/files/:key/comments — all comments on a file. */
  async list(fileKey: string): Promise<FigmaComment[]> {
    const resp = await this.client.get<FigmaCommentsResponse>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments`,
    );
    return resp.comments ?? [];
  }

  /** POST /v1/files/:key/comments — create a comment. */
  async create(
    fileKey: string,
    body: { message: string; client_meta?: unknown; comment_id?: string },
  ): Promise<FigmaComment> {
    return this.client.post<FigmaComment>(`/v1/files/${encodeURIComponent(fileKey)}/comments`, {
      body,
    });
  }

  /** DELETE /v1/files/:key/comments/:id — delete a comment. */
  async delete(fileKey: string, commentId: string): Promise<void> {
    await this.client.delete<void>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}`,
    );
  }

  /** GET /v1/files/:key/comments/:id/reactions — list reactions on a comment. */
  async reactions(fileKey: string, commentId: string): Promise<unknown> {
    return this.client.get<unknown>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}/reactions`,
    );
  }

  /** POST /v1/files/:key/comments/:id/reactions — add a reaction. */
  async addReaction(fileKey: string, commentId: string, emoji: string): Promise<unknown> {
    return this.client.post<unknown>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}/reactions`,
      { body: { emoji } },
    );
  }

  /** DELETE /v1/files/:key/comments/:id/reactions — remove a reaction. */
  async removeReaction(fileKey: string, commentId: string, emoji: string): Promise<void> {
    await this.client.delete<void>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}/reactions`,
      { params: { emoji } },
    );
  }
}
