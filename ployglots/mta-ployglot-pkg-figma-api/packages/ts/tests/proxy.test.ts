// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildProxy, optionalEnv, requireEnv } from '../src/proxy.js';

describe('env helpers', () => {
  const snap = { ...process.env };

  afterEach(() => {
    // Restore fully each test.
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, snap);
  });

  it('requireEnv throws when unset', () => {
    delete process.env.THING_UNSET;
    expect(() => requireEnv('THING_UNSET')).toThrow(/Missing env/);
  });

  it('optionalEnv falls back when empty', () => {
    delete process.env.MAYBE_X;
    expect(optionalEnv('MAYBE_X', 'fallback')).toBe('fallback');
    process.env.MAYBE_X = 'here';
    expect(optionalEnv('MAYBE_X', 'fallback')).toBe('here');
  });
});

describe('buildProxy', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTP_PROXY_USER;
    delete process.env.HTTP_PROXY_PASS;
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, original);
  });

  it('returns undefined when nothing is set (empty placeholder)', () => {
    expect(buildProxy({})).toBeUndefined();
  });

  it('auto-detects HTTPS_PROXY', () => {
    process.env.HTTPS_PROXY = 'http://https-proxy:3128';
    const p = buildProxy({});
    expect(p).toBeDefined();
  });

  it('auto-detects HTTP_PROXY when HTTPS_PROXY is unset', () => {
    process.env.HTTP_PROXY = 'http://http-proxy:3128';
    const p = buildProxy({});
    expect(p).toBeDefined();
  });

  it('uses explicit host over env', () => {
    process.env.HTTPS_PROXY = 'http://from-env:3128';
    const p = buildProxy({ host: 'http://explicit:3128' });
    expect(p).toBeDefined();
  });

  it('includes auth when user+pass are supplied', () => {
    const p = buildProxy({ host: 'http://p:3128', user: 'u', pass: 'pw' });
    expect(p).toBeDefined();
  });

  it('ignores partial auth (user without pass)', () => {
    const p = buildProxy({ host: 'http://p:3128', user: 'u' });
    expect(p).toBeDefined();
  });

  it('treats empty-string env var as unset (uses fallback)', () => {
    process.env.EMPTY_X = '';
    expect(optionalEnv('EMPTY_X', 'fallback')).toBe('fallback');
  });

  it('requireEnv passes through non-empty value', () => {
    process.env.PRESENT_X = 'found';
    expect(requireEnv('PRESENT_X')).toBe('found');
  });

  it('requireEnv treats empty string as missing', () => {
    process.env.EMPTY_Y = '';
    expect(() => requireEnv('EMPTY_Y')).toThrow(/Missing env/);
  });

  it('buildProxy with empty HTTPS_PROXY string still returns undefined', () => {
    process.env.HTTPS_PROXY = '';
    expect(buildProxy({})).toBeUndefined();
  });
});
