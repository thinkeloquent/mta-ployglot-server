// @ts-nocheck
import logger from '../logger.js';
import type { Request } from '../models/request.js';
import type { Response } from '../models/response.js';

const log = logger.create('@polyglot/fetch-http-client', 'auth/base.ts');

export abstract class Auth {
  abstract apply(request: Request, response?: Response): Request | Promise<Request>;

  get requiresChallenge(): boolean {
    return false;
  }

  canHandleChallenge(_response: Response): boolean {
    return false;
  }

  protected logApply(type: string, details?: Record<string, unknown>): void {
    log.debug('auth applied', { type, ...(details ?? {}) });
  }
}

export class NoAuth extends Auth {
  apply(request: Request): Request {
    this.logApply('none');
    return request;
  }
}

export function isAuth(value: unknown): value is Auth {
  return value instanceof Auth;
}
