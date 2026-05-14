// @ts-nocheck
import type { FigmaClient } from '../figma-client.js';
import type { FigmaProjectFilesResponse, FigmaTeamProjectsResponse } from './types.js';

export class ProjectsResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/teams/:team_id/projects — projects owned by a team. */
  async listForTeam(teamId: string): Promise<FigmaTeamProjectsResponse> {
    return this.client.get<FigmaTeamProjectsResponse>(
      `/v1/teams/${encodeURIComponent(teamId)}/projects`,
    );
  }

  /** GET /v1/projects/:project_id/files — files inside a project. */
  async listFiles(projectId: string): Promise<FigmaProjectFilesResponse> {
    return this.client.get<FigmaProjectFilesResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}/files`,
    );
  }
}
