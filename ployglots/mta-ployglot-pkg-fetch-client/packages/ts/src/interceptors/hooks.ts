// @ts-nocheck
import logger from '../logger.js';
import type { Request } from '../models/request.js';
import type { Response } from '../models/response.js';

const _log = logger.create('@polyglot/fetch-http-client', 'interceptors/hooks.ts');
void _log;

export type RequestHook = (request: Request) => void | Promise<void>;
export type ResponseHook = (response: Response) => void | Promise<void>;

export interface EventHooksConfig {
  onRequest?: RequestHook | RequestHook[];
  onResponse?: ResponseHook | ResponseHook[];
}

export class HooksManager {
  private _requestHooks: RequestHook[] = [];
  private _responseHooks: ResponseHook[] = [];

  constructor(config: EventHooksConfig = {}) {
    if (config.onRequest) {
      this._requestHooks = Array.isArray(config.onRequest)
        ? [...config.onRequest]
        : [config.onRequest];
    }
    if (config.onResponse) {
      this._responseHooks = Array.isArray(config.onResponse)
        ? [...config.onResponse]
        : [config.onResponse];
    }
  }

  addRequestHook(hook: RequestHook): void {
    this._requestHooks.push(hook);
  }
  addResponseHook(hook: ResponseHook): void {
    this._responseHooks.push(hook);
  }

  removeRequestHook(hook: RequestHook): boolean {
    const idx = this._requestHooks.indexOf(hook);
    if (idx < 0) return false;
    this._requestHooks.splice(idx, 1);
    return true;
  }

  removeResponseHook(hook: ResponseHook): boolean {
    const idx = this._responseHooks.indexOf(hook);
    if (idx < 0) return false;
    this._responseHooks.splice(idx, 1);
    return true;
  }

  async callRequestHooks(request: Request): Promise<void> {
    for (const hook of this._requestHooks) await hook(request);
  }

  async callResponseHooks(response: Response): Promise<void> {
    for (const hook of this._responseHooks) await hook(response);
  }

  get requestHookCount(): number {
    return this._requestHooks.length;
  }
  get responseHookCount(): number {
    return this._responseHooks.length;
  }
}

export function createHooksManager(config?: EventHooksConfig): HooksManager {
  return new HooksManager(config);
}
