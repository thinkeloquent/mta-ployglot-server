// @ts-nocheck
/**
 * Shared Figma API response types. Kept minimal — the package is a
 * thin transport wrapper; downstream callers can cast to richer types
 * when needed.
 */

export interface FigmaUser {
  id: string;
  email?: string;
  handle: string;
  img_url?: string;
}

export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  version: string;
  role?: string;
  editorType?: string;
  linkAccess?: string;
  document?: unknown;
  components?: Record<string, unknown>;
  componentSets?: Record<string, unknown>;
  schemaVersion?: number;
  styles?: Record<string, unknown>;
}

export interface FigmaComment {
  id: string;
  uuid?: string;
  file_key?: string;
  parent_id?: string;
  user: FigmaUser;
  created_at: string;
  resolved_at?: string | null;
  message: string;
  client_meta?: unknown;
  order_id?: string;
}

export interface FigmaCommentsResponse {
  comments: FigmaComment[];
}

export interface FigmaProject {
  id: string;
  name: string;
}

export interface FigmaTeamProjectsResponse {
  name?: string;
  projects: FigmaProject[];
}

export interface FigmaProjectFile {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified: string;
}

export interface FigmaProjectFilesResponse {
  name: string;
  files: FigmaProjectFile[];
}

export interface FigmaFileRequestOptions {
  version?: string;
  ids?: string[];
  depth?: number;
  geometry?: 'paths';
  plugin_data?: string;
  branch_data?: boolean;
}
