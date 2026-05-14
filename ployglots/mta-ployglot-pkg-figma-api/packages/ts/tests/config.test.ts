// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_FIGMA_HOST, resolveFigmaConfig } from '../src/config.js';
import { FigmaConfigError } from '../src/errors.js';

describe('resolveFigmaConfig', () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {
      FIGMA_HOST: process.env.FIGMA_HOST,
      FIGMA_USER: process.env.FIGMA_USER,
      FIGMA_PASS: process.env.FIGMA_PASS,
    };
    delete process.env.FIGMA_HOST;
    delete process.env.FIGMA_USER;
    delete process.env.FIGMA_PASS;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('uses explicit token + host over env', () => {
    process.env.FIGMA_HOST = 'https://from-env.example';
    process.env.FIGMA_PASS = 'env-token';
    const cfg = resolveFigmaConfig({ token: 'explicit', host: 'https://explicit.example' });
    expect(cfg.token).toBe('explicit');
    expect(cfg.host).toBe('https://explicit.example');
  });

  it('falls back to FIGMA_PASS env when no token passed', () => {
    process.env.FIGMA_PASS = 'env-token';
    const cfg = resolveFigmaConfig();
    expect(cfg.token).toBe('env-token');
    expect(cfg.host).toBe(DEFAULT_FIGMA_HOST);
  });

  it('exposes FIGMA_USER as a placeholder', () => {
    process.env.FIGMA_PASS = 'env-token';
    process.env.FIGMA_USER = 'me@example.com';
    const cfg = resolveFigmaConfig();
    expect(cfg.user).toBe('me@example.com');
  });

  it('throws FigmaConfigError when token is missing', () => {
    expect(() => resolveFigmaConfig()).toThrow(FigmaConfigError);
  });

  it('rejects non-http host', () => {
    expect(() => resolveFigmaConfig({ token: 't', host: 'ftp://bad' })).toThrow(FigmaConfigError);
  });

  it('propagates a proxy bag verbatim', () => {
    const cfg = resolveFigmaConfig({ token: 't', proxy: { host: 'http://p:3128' } });
    expect(cfg.proxy).toEqual({ host: 'http://p:3128' });
  });

  it('accepts proxy={} (empty placeholder → auto-detect later)', () => {
    const cfg = resolveFigmaConfig({ token: 't', proxy: {} });
    expect(cfg.proxy).toEqual({});
  });
});
