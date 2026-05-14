// @ts-nocheck
/**
 * Figma-sensible retry defaults + user override with a `forceOverwrite`
 * feature flag.
 *
 * The underlying `@polyglot/fetch-http-client` AsyncClient already
 * ships a generic retry loop — this module just hands it a config
 * pre-tuned for Figma's behavior:
 *
 *   - Retry on 429 + 5xx (Figma rate-limits on 429 with Retry-After).
 *   - 3 attempts total, exponential 1s → 30s with FULL jitter.
 *   - Respect the `Retry-After` header.
 *   - Retry on transport-layer errors (ECONNRESET, etc).
 *
 * Consumer contract:
 *
 *   // 1. Default — Figma presets take effect.
 *   new FigmaClient({ token });
 *
 *   // 2. Disable inner retry (plan "Mode B" — outer AsyncClient owns it).
 *   new FigmaClient({ token, retry: false });
 *
 *   // 3. Tweak selectively (merges on top of the Figma defaults).
 *   new FigmaClient({ token, retry: { maxRetries: 5 } });
 *
 *   // 4. forceOverwrite = replace defaults verbatim (no merge).
 *   new FigmaClient({
 *     token,
 *     retry: { maxRetries: 1, retryOnStatus: [503] },
 *     forceOverwriteRetry: true,
 *   });
 */

import type { RetryConfig } from '@polyglot/fetch-http-client';

export type FigmaRetryInput = Partial<RetryConfig> | false | null | undefined;

/**
 * Figma-sensible retry defaults. Derived from:
 *   - Figma's documented rate-limiting strategy (429 + Retry-After)
 *   - Typical 5xx transient patterns (502/503/504)
 */
export const FIGMA_DEFAULT_RETRY: Partial<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoff: 2,
  maxRetryDelay: 30_000,
  retryOnStatus: [429, 500, 502, 503, 504],
  retryOnException: true,
  respectRetryAfter: true,
};

export interface BuildFigmaRetryOptions {
  /**
   * When `true`, user retry options REPLACE the Figma defaults verbatim
   * (no merge). When `false` or omitted, user options are merged on
   * top of `FIGMA_DEFAULT_RETRY` so callers can tweak just the knobs
   * they care about.
   *
   * Named `forceOverwrite` to signal: you're opting out of Figma's
   * opinionated defaults. Use only if you have a reason (e.g. testing,
   * or a non-standard Figma deployment).
   */
  forceOverwrite?: boolean;
}

/**
 * Build the retry config that should be passed to the underlying
 * fetch-http-client AsyncClient.
 *
 * Returns `false` to mean "disable retry", `undefined` to mean
 * "AsyncClient default" (no retry), or a `Partial<RetryConfig>` to
 * enable retry with those knobs.
 */
export function buildFigmaRetryConfig(
  input: FigmaRetryInput,
  options: BuildFigmaRetryOptions = {},
): Partial<RetryConfig> | false {
  // Explicit disable.
  if (input === false || input === null) return false;

  // No input → use Figma defaults.
  if (input === undefined) return { ...FIGMA_DEFAULT_RETRY };

  // forceOverwrite → user wins verbatim, no merge with Figma defaults.
  if (options.forceOverwrite === true) return { ...input };

  // Default path → merge user on top of Figma defaults.
  return {
    ...FIGMA_DEFAULT_RETRY,
    ...input,
    // retryOnStatus: if the caller passed one, take it; otherwise keep Figma's.
    retryOnStatus: input.retryOnStatus ?? FIGMA_DEFAULT_RETRY.retryOnStatus,
  };
}
