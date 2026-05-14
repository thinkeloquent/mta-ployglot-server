// @ts-nocheck
import type { Dispatcher } from 'undici';
import logger, { type Logger, type LogLevel } from '../logger.js';

export interface LoggingInterceptorOptions {
  logger?: Logger;
  level?: LogLevel;
  redactHeaders?: string[];
}

const DEFAULT_REDACT = ['authorization', 'cookie', 'x-api-key'];

function shouldRedact(name: string, set: Set<string>): boolean {
  return set.has(name.toLowerCase());
}

function normalizeRequestHeaders(headers: unknown, redactSet: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (Array.isArray(headers)) {
    for (let i = 0; i < headers.length; i += 2) {
      const k = String(headers[i]);
      const v = String(headers[i + 1] ?? '');
      out[k] = shouldRedact(k, redactSet) ? '[REDACTED]' : v;
    }
    return out;
  }
  if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      const value = Array.isArray(v) ? v.join(', ') : String(v);
      out[k] = shouldRedact(k, redactSet) ? '[REDACTED]' : value;
    }
  }
  return out;
}

function normalizeResponseHeaders(
  rawHeaders: Buffer[] | string[] | undefined,
  redactSet: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawHeaders) return out;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const k = rawHeaders[i]?.toString() ?? '';
    const v = rawHeaders[i + 1]?.toString() ?? '';
    out[k] = shouldRedact(k, redactSet) ? '[REDACTED]' : v;
  }
  return out;
}

export function createLoggingInterceptor(
  options: LoggingInterceptorOptions = {},
): Dispatcher.DispatcherComposeInterceptor {
  const log =
    options.logger ?? logger.create('@polyglot/fetch-http-client', 'interceptors/logging.ts');
  const redactSet = new Set(
    [...DEFAULT_REDACT, ...(options.redactHeaders ?? [])].map((s) => s.toLowerCase()),
  );

  return (dispatch) => {
    return function logInterceptor(opts, handler) {
      const reqHeaders = normalizeRequestHeaders(
        (opts as { headers?: unknown }).headers,
        redactSet,
      );
      log.info('outgoing request', {
        method: (opts as { method?: string }).method,
        path: (opts as { path?: string }).path,
        headers: reqHeaders,
      });

      const wrapped: Dispatcher.DispatchHandler = {
        ...handler,
        onHeaders(statusCode, headers, ...rest) {
          log.info('incoming response', {
            statusCode,
            headers: normalizeResponseHeaders(headers as Buffer[], redactSet),
          });
          // Forward to user handler with original args.
          return (
            (
              handler as unknown as {
                onHeaders?: (...a: unknown[]) => boolean;
              }
            ).onHeaders?.(statusCode as number, headers, ...(rest as unknown[])) ?? true
          );
        },
      } as Dispatcher.DispatchHandler;

      return dispatch(opts, wrapped);
    };
  };
}
