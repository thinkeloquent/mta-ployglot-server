// @ts-nocheck
/**
 * Typed error hierarchy for @polyglot/figma-api.
 *
 * All errors extend `FigmaError` so callers can catch the package's
 * entire surface with one check. Subclasses encode *what kind of
 * failure* occurred (auth, rate-limit, not-found, transport, …)
 * without leaking underlying transport details.
 */

export class FigmaError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = 'FigmaError';
    this.cause = options.cause;
  }
}

export class FigmaConfigError extends FigmaError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'FigmaConfigError';
  }
}

export class FigmaAuthError extends FigmaError {
  readonly status: number;

  constructor(message: string, status = 401, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'FigmaAuthError';
    this.status = status;
  }
}

export class FigmaNotFoundError extends FigmaError {
  readonly status = 404;

  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'FigmaNotFoundError';
  }
}

export class FigmaRateLimitError extends FigmaError {
  readonly status = 429;
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, retryAfterSeconds?: number, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'FigmaRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class FigmaServerError extends FigmaError {
  readonly status: number;

  constructor(message: string, status: number, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'FigmaServerError';
    this.status = status;
  }
}

export class FigmaTransportError extends FigmaError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'FigmaTransportError';
  }
}

export interface FigmaErrorContext {
  method: string;
  url: string;
  status: number;
  body?: string;
  retryAfter?: string | null;
}

/**
 * Map an HTTP response into the right `FigmaError` subclass.
 * Callers pass status + body + request context; this function picks
 * the most specific error class for the status bucket.
 */
export function mapHttpError(ctx: FigmaErrorContext): FigmaError {
  const { status, method, url, body } = ctx;
  const snippet = body !== undefined && body.length > 0 ? ` — ${body.slice(0, 200)}` : '';
  const prefix = `${method} ${url} → ${status}`;

  if (status === 401 || status === 403) {
    return new FigmaAuthError(`${prefix}${snippet}`, status);
  }
  if (status === 404) {
    return new FigmaNotFoundError(`${prefix}${snippet}`);
  }
  if (status === 429) {
    const retryAfter = ctx.retryAfter ? Number.parseInt(ctx.retryAfter, 10) : undefined;
    return new FigmaRateLimitError(
      `${prefix}${snippet}`,
      Number.isFinite(retryAfter) ? (retryAfter as number) : undefined,
    );
  }
  if (status >= 500) {
    return new FigmaServerError(`${prefix}${snippet}`, status);
  }
  return new FigmaError(`${prefix}${snippet}`);
}
