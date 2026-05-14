// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { FIGMA_DEFAULT_RETRY, buildFigmaRetryConfig } from '../src/retry.js';

describe('buildFigmaRetryConfig', () => {
  it('returns Figma defaults when no input provided', () => {
    const cfg = buildFigmaRetryConfig(undefined);
    expect(cfg).not.toBe(false);
    expect(cfg).toMatchObject(FIGMA_DEFAULT_RETRY);
  });

  it('returns false when input is false (disable)', () => {
    expect(buildFigmaRetryConfig(false)).toBe(false);
    expect(buildFigmaRetryConfig(null)).toBe(false);
  });

  it('merges user options on top of defaults', () => {
    const cfg = buildFigmaRetryConfig({ maxRetries: 5 });
    expect(cfg).not.toBe(false);
    expect(cfg).toMatchObject({
      maxRetries: 5,
      retryDelay: FIGMA_DEFAULT_RETRY.retryDelay,
      retryOnStatus: FIGMA_DEFAULT_RETRY.retryOnStatus,
      respectRetryAfter: true,
    });
  });

  it('forceOverwrite=true replaces defaults verbatim', () => {
    const cfg = buildFigmaRetryConfig(
      { maxRetries: 1, retryOnStatus: [503] },
      { forceOverwrite: true },
    );
    expect(cfg).toEqual({ maxRetries: 1, retryOnStatus: [503] });
    // no respectRetryAfter inherited
    expect((cfg as { respectRetryAfter?: boolean }).respectRetryAfter).toBeUndefined();
  });

  it('user retryOnStatus wins when provided (no forceOverwrite)', () => {
    const cfg = buildFigmaRetryConfig({ retryOnStatus: [418] });
    expect((cfg as { retryOnStatus: number[] }).retryOnStatus).toEqual([418]);
  });

  it('explicit empty object gets Figma defaults', () => {
    const cfg = buildFigmaRetryConfig({});
    expect(cfg).toMatchObject(FIGMA_DEFAULT_RETRY);
  });
});
