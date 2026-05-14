// @ts-nocheck
import { createWriteStream } from 'node:fs';
import logger from '../logger.js';
import { AsyncClient } from '../client/client.js';
import type { AsyncClientOptions, RequestOptions } from '../client/options.js';
import type { Response } from '../models/response.js';

const _log = logger.create('@polyglot/fetch-http-client', 'sdk/cli.ts');
void _log;

export type ProgressCallback = (bytesDownloaded: number, totalBytes?: number) => void;

export interface CLIContextOptions extends AsyncClientOptions {}

export interface DownloadResult {
  success: boolean;
  statusCode: number;
  bytesDownloaded: number;
  outputPath?: string;
  error?: string;
  exitCode: number;
}

export class CLIContext {
  private readonly _client: AsyncClient;

  constructor(options: CLIContextOptions = {}) {
    this._client = new AsyncClient({ followRedirects: true, maxRedirects: 10, ...options });
  }

  async request(method: string, url: string | URL, options?: RequestOptions): Promise<Response> {
    return this._client.request(method, url, options);
  }

  async close(): Promise<void> {
    await this._client.close();
  }

  private _statusToExitCode(statusCode: number): number {
    if (statusCode === 0) return 1;
    if (statusCode >= 200 && statusCode < 300) return 0;
    if (statusCode >= 400 && statusCode < 500) return 4;
    if (statusCode >= 500 && statusCode < 600) return 5;
    return 0;
  }

  async download(
    url: string | URL,
    opts: { output: string; method?: string; onProgress?: ProgressCallback } & RequestOptions,
  ): Promise<DownloadResult> {
    const { output, method = 'GET', onProgress, ...requestOptions } = opts;
    try {
      const response = await this._client.request(method, url, requestOptions);
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.statusCode,
          bytesDownloaded: 0,
          error: `HTTP ${response.statusCode}`,
          exitCode: this._statusToExitCode(response.statusCode),
        };
      }
      const outStream = createWriteStream(output);
      const totalBytes = response.contentLength;
      let bytesDownloaded = 0;
      for await (const chunk of response.aiterBytes()) {
        outStream.write(chunk);
        bytesDownloaded += chunk.length;
        onProgress?.(bytesDownloaded, totalBytes);
      }
      await new Promise<void>((resolve) => outStream.end(() => resolve()));
      return {
        success: true,
        statusCode: response.statusCode,
        bytesDownloaded,
        outputPath: output,
        exitCode: 0,
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        bytesDownloaded: 0,
        error: String((err as Error)?.message ?? err),
        exitCode: 1,
      };
    }
  }

  async *streamToStdout(
    method: string,
    url: string | URL,
    options?: RequestOptions,
  ): AsyncGenerator<number> {
    const response = await this._client.request(method, url, options);
    for await (const chunk of response.aiterBytes()) {
      process.stdout.write(chunk);
      yield chunk.length;
    }
  }
}

export function createCLIContext(options?: CLIContextOptions): CLIContext {
  return new CLIContext(options);
}
