// @ts-nocheck
import type { FigmaClient } from '../figma-client.js';
import type { FigmaFile, FigmaFileRequestOptions } from './types.js';

function stringifyParams(
  opts: FigmaFileRequestOptions = {},
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (opts.version !== undefined) params.version = opts.version;
  if (opts.ids && opts.ids.length > 0) params.ids = opts.ids.join(',');
  if (opts.depth !== undefined) params.depth = opts.depth;
  if (opts.geometry !== undefined) params.geometry = opts.geometry;
  if (opts.plugin_data !== undefined) params.plugin_data = opts.plugin_data;
  if (opts.branch_data !== undefined) params.branch_data = opts.branch_data;
  return params;
}

export class FilesResource {
  constructor(private readonly client: FigmaClient) {}

  /** GET /v1/files/:key — full file document. */
  async get(fileKey: string, options: FigmaFileRequestOptions = {}): Promise<FigmaFile> {
    return this.client.get<FigmaFile>(`/v1/files/${encodeURIComponent(fileKey)}`, {
      params: stringifyParams(options),
    });
  }

  /** GET /v1/files/:key/nodes — subset of nodes. */
  async nodes(fileKey: string, ids: string[]): Promise<unknown> {
    return this.client.get<unknown>(`/v1/files/${encodeURIComponent(fileKey)}/nodes`, {
      params: { ids: ids.join(',') },
    });
  }

  /** GET /v1/images/:key — exported image URLs for selected nodes. */
  async images(
    fileKey: string,
    ids: string[],
    params: { format?: 'jpg' | 'png' | 'svg' | 'pdf'; scale?: number } = {},
  ): Promise<unknown> {
    const queryParams: Record<string, string | number> = { ids: ids.join(',') };
    if (params.format !== undefined) queryParams.format = params.format;
    if (params.scale !== undefined) queryParams.scale = params.scale;
    return this.client.get<unknown>(`/v1/images/${encodeURIComponent(fileKey)}`, {
      params: queryParams,
    });
  }

  /** GET /v1/files/:key/images — image fills uploaded to the file. */
  async imageFills(fileKey: string): Promise<unknown> {
    return this.client.get<unknown>(`/v1/files/${encodeURIComponent(fileKey)}/images`);
  }

  /** GET /v1/files/:key/meta — file metadata (name, version, thumbnail). */
  async meta(fileKey: string): Promise<unknown> {
    return this.client.get<unknown>(`/v1/files/${encodeURIComponent(fileKey)}/meta`);
  }

  /** GET /v1/files/:key/versions — version history (paginated). */
  async versions(
    fileKey: string,
    params: { page_size?: number; before?: string; after?: string } = {},
  ): Promise<unknown> {
    const queryParams: Record<string, string | number> = {};
    if (params.page_size !== undefined) queryParams.page_size = params.page_size;
    if (params.before !== undefined) queryParams.before = params.before;
    if (params.after !== undefined) queryParams.after = params.after;
    return this.client.get<unknown>(`/v1/files/${encodeURIComponent(fileKey)}/versions`, {
      params: queryParams,
    });
  }
}
