// @ts-nocheck
import logger, { type Logger } from '../logger.js';
import { AsyncClient } from '../client/client.js';
import type { AsyncClientOptions, RequestOptions } from '../client/options.js';
import type { Response } from '../models/response.js';

export interface AgentResponse<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
  suggestion?: string;
  summary: string;
  headers: Record<string, string | string[]>;
  duration: number;
}

export interface AgentHTTPClientOptions extends AsyncClientOptions {}

export class AgentHTTPClient {
  private readonly _client: AsyncClient;
  private readonly _logger: Logger;

  constructor(options: AgentHTTPClientOptions = {}) {
    this._client = new AsyncClient(options);
    this._logger = options.logger ?? logger.create('@polyglot/fetch-http-client', 'sdk/agent.ts');
  }

  async request<T>(
    method: string,
    url: string | URL,
    options?: RequestOptions,
  ): Promise<AgentResponse<T>> {
    const startTime = Date.now();
    try {
      const response = await this._client.request(method, url, options);
      return this._formatResponse<T>(response, Date.now() - startTime);
    } catch (err) {
      this._logger.debug('agent request failed', { error: (err as Error).message });
      return this._formatError<T>(err, Date.now() - startTime);
    }
  }

  async get<T>(url: string | URL, options?: RequestOptions): Promise<AgentResponse<T>> {
    return this.request<T>('GET', url, options);
  }
  async post<T>(url: string | URL, options?: RequestOptions): Promise<AgentResponse<T>> {
    return this.request<T>('POST', url, options);
  }
  async put<T>(url: string | URL, options?: RequestOptions): Promise<AgentResponse<T>> {
    return this.request<T>('PUT', url, options);
  }
  async delete<T>(url: string | URL, options?: RequestOptions): Promise<AgentResponse<T>> {
    return this.request<T>('DELETE', url, options);
  }

  async close(): Promise<void> {
    await this._client.close();
  }

  private async _formatResponse<T>(
    response: Response,
    duration: number,
  ): Promise<AgentResponse<T>> {
    if (response.ok) {
      const data = await response.json<T>();
      return {
        success: true,
        statusCode: response.statusCode,
        data,
        summary: this._generateSuccessSummary(data),
        headers: response.headers.toObject(),
        duration,
      };
    }
    const info = this._getErrorInfo(response.statusCode);
    return {
      success: false,
      statusCode: response.statusCode,
      error: info.error,
      suggestion: info.suggestion,
      summary: `Request failed with ${info.error}`,
      headers: response.headers.toObject(),
      duration,
    };
  }

  private _formatError<T>(err: unknown, duration: number): AgentResponse<T> {
    const info = this._getNetworkErrorInfo(err);
    return {
      success: false,
      statusCode: 0,
      error: info.error,
      suggestion: info.suggestion,
      summary: `Network error: ${info.error}`,
      headers: {},
      duration,
    };
  }

  private _generateSuccessSummary(data: unknown): string {
    if (Array.isArray(data)) return `Retrieved ${data.length} items`;
    if (data && typeof data === 'object') {
      const keys = Object.keys(data as Record<string, unknown>).slice(0, 5);
      return `Retrieved object with keys: ${keys.join(', ')}`;
    }
    if (typeof data === 'string') return `Retrieved text (${data.length} chars)`;
    if (data == null) return 'Request succeeded (no content)';
    return 'Request succeeded';
  }

  private _getErrorInfo(statusCode: number): { error: string; suggestion: string } {
    switch (statusCode) {
      case 400:
        return { error: 'Bad Request', suggestion: 'Verify request payload and headers.' };
      case 401:
        return { error: 'Unauthorized', suggestion: 'Check credentials or refresh the token.' };
      case 403:
        return {
          error: 'Forbidden',
          suggestion: 'Verify the account has access to this resource.',
        };
      case 404:
        return { error: 'Not Found', suggestion: 'Verify the URL/path and resource ID.' };
      case 429:
        return {
          error: 'Too Many Requests',
          suggestion: 'Respect the rate limit (Retry-After header) before retrying.',
        };
      case 500:
        return { error: 'Internal Server Error', suggestion: 'Retry later; consider backoff.' };
      case 502:
        return { error: 'Bad Gateway', suggestion: 'Upstream service is unhealthy; retry.' };
      case 503:
        return {
          error: 'Service Unavailable',
          suggestion: 'Service is overloaded; retry with backoff.',
        };
      default:
        return { error: `HTTP ${statusCode}`, suggestion: 'Check the response for details.' };
    }
  }

  private _getNetworkErrorInfo(err: unknown): { error: string; suggestion: string } {
    const message = (err as Error)?.message ?? String(err);
    const code = (err as { code?: string })?.code ?? '';
    const probe = `${code} ${message}`;
    if (/timeout|timedout|etimedout|esockettimedout/i.test(probe))
      return {
        error: 'Request timed out',
        suggestion: 'Increase timeout or check upstream latency.',
      };
    if (/econnrefused|connection refused/i.test(probe))
      return { error: 'Connection refused', suggestion: 'Verify the host and port are reachable.' };
    if (/enotfound|dns lookup failed/i.test(probe))
      return {
        error: 'DNS lookup failed',
        suggestion: 'Verify the hostname is correct and resolvable.',
      };
    return { error: message, suggestion: 'Verify network connectivity.' };
  }
}

export function createAgentHTTPClient(options?: AgentHTTPClientOptions): AgentHTTPClient {
  return new AgentHTTPClient(options);
}
