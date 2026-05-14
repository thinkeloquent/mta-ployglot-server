// @ts-nocheck
/**
 * Resolve FigmaClient config from explicit options + env fallbacks.
 */

import { FigmaConfigError } from './errors.js';
import { optionalEnv, type ProxyOptionsBag } from './proxy.js';
import type { FigmaRetryInput } from './retry.js';

export const DEFAULT_FIGMA_HOST = 'https://api.figma.com';

export interface FigmaConfigInput {
  /** Figma Personal Access Token. Falls back to env `FIGMA_PASS`. */
  token?: string;
  /** Figma REST host. Falls back to env `FIGMA_HOST`, then default. */
  host?: string;
  /** Optional user identifier — kept for ENV symmetry only. */
  user?: string;
  /** Optional proxy bag. `{}` = auto-detect from env. */
  proxy?: ProxyOptionsBag;
  /** Override outbound request timeout (ms). */
  timeoutMs?: number;
  /** Extra headers to attach to every request. */
  defaultHeaders?: Record<string, string>;
  /**
   * Retry config. Default is Figma-sensible presets. Pass `false` to
   * disable, or `{...}` to merge on top. See `buildFigmaRetryConfig`.
   */
  retry?: FigmaRetryInput;
  /**
   * Feature flag — when true, `retry` REPLACES the Figma defaults
   * verbatim instead of merging. Opt out of the presets only when
   * you have a clear reason (testing, non-standard deployments).
   */
  forceOverwriteRetry?: boolean;
}

export interface FigmaConfig {
  host: string;
  token: string;
  user: string;
  proxy: ProxyOptionsBag | undefined;
  timeoutMs: number;
  defaultHeaders: Record<string, string>;
  retry: FigmaRetryInput;
  forceOverwriteRetry: boolean;
}

export function resolveFigmaConfig(input: FigmaConfigInput = {}): FigmaConfig {
  const host = input.host ?? optionalEnv('FIGMA_HOST', DEFAULT_FIGMA_HOST);
  const token = input.token ?? process.env.FIGMA_PASS ?? '';
  const user = input.user ?? optionalEnv('FIGMA_USER', '');

  if (token.length === 0) {
    throw new FigmaConfigError(
      'FigmaClient requires a token. Pass `{ token }` or set env FIGMA_PASS.',
    );
  }
  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    throw new FigmaConfigError(`Invalid FIGMA_HOST: ${host}. Must start with http(s)://`);
  }

  return {
    host,
    token,
    user,
    proxy: input.proxy,
    timeoutMs: input.timeoutMs ?? 30_000,
    defaultHeaders: input.defaultHeaders ?? {},
    retry: input.retry,
    forceOverwriteRetry: input.forceOverwriteRetry ?? false,
  };
}
