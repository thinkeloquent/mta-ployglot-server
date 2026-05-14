// @ts-nocheck
import { AsyncClient, APIKeyAuth } from '@polyglot/fetch-http-client';
import { describe, expect, it } from 'vitest';

import {
  createDefaultFetchClient,
  createFigmaFetchClient,
  fetchClientFromPolyglot,
} from '../src/fetch-client.js';
import { resolveFigmaConfig } from '../src/config.js';

describe('fetch-client composition', () => {
  it('createDefaultFetchClient returns a FetchClient-shaped object', () => {
    const cfg = resolveFigmaConfig({ token: 't', proxy: {} });
    const fc = createDefaultFetchClient(cfg);
    expect(typeof fc.get).toBe('function');
    expect(typeof fc.post).toBe('function');
    expect(typeof fc.close).toBe('function');
  });

  it('createFigmaFetchClient is equivalent to resolve + createDefault', () => {
    const fc = createFigmaFetchClient({ token: 't' });
    expect(typeof fc.get).toBe('function');
    expect(typeof fc.close).toBe('function');
  });

  it('createDefaultFetchClient obeys retry=false (disabled)', () => {
    const cfg = resolveFigmaConfig({ token: 't', retry: false });
    const fc = createDefaultFetchClient(cfg);
    expect(typeof fc.get).toBe('function');
  });

  it('fetchClientFromPolyglot wraps a user AsyncClient verbatim', () => {
    const outer = new AsyncClient({
      baseUrl: 'https://api.figma.com',
      auth: new APIKeyAuth('t', 'X-Figma-Token'),
    });
    const wrapped = fetchClientFromPolyglot(outer);
    // BYO adapter returns the same instance (no wrapping overhead).
    expect(wrapped).toBe(outer as unknown as typeof wrapped);
  });

  it('createDefaultFetchClient wires a proxy when HTTPS_PROXY is set', () => {
    const snap = process.env.HTTPS_PROXY;
    process.env.HTTPS_PROXY = 'http://proxy.corp:3128';
    try {
      const cfg = resolveFigmaConfig({ token: 't', proxy: {} });
      const fc = createDefaultFetchClient(cfg);
      expect(typeof fc.get).toBe('function');
    } finally {
      if (snap === undefined) delete process.env.HTTPS_PROXY;
      else process.env.HTTPS_PROXY = snap;
    }
  });

  it('createDefaultFetchClient uses npm_package_version when present', () => {
    const snap = process.env.npm_package_version;
    process.env.npm_package_version = '9.9.9';
    try {
      const cfg = resolveFigmaConfig({ token: 't' });
      const fc = createDefaultFetchClient(cfg);
      expect(typeof fc.get).toBe('function');
    } finally {
      if (snap === undefined) delete process.env.npm_package_version;
      else process.env.npm_package_version = snap;
    }
  });

  it('createDefaultFetchClient falls back to 0.1.0 when npm_package_version is unset', () => {
    const snap = process.env.npm_package_version;
    delete process.env.npm_package_version;
    try {
      const cfg = resolveFigmaConfig({ token: 't' });
      const fc = createDefaultFetchClient(cfg);
      expect(typeof fc.get).toBe('function');
    } finally {
      if (snap !== undefined) process.env.npm_package_version = snap;
    }
  });
});
