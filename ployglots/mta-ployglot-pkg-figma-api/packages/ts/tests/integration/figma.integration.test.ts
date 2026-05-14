// @ts-nocheck
/**
 * Integration tests — hit the real Figma REST API.
 *
 * Gated by the `FIGMA_PASS` env variable: when unset, the entire
 * suite skips rather than failing CI. Optionally reads:
 *
 *   FIGMA_HOST     override API host (default https://api.figma.com)
 *   FIGMA_USER     placeholder, surfaced for ENV symmetry
 *   FIGMA_FILE_KEY optional file key for the file-read smoke
 *   HTTPS_PROXY / HTTP_PROXY / HTTP_PROXY_USER / HTTP_PROXY_PASS
 */

import { describe, expect, it } from 'vitest';

import { FigmaAuthError, FigmaClient } from '../../src/index.js';

const token = process.env.FIGMA_PASS;
const fileKey = process.env.FIGMA_FILE_KEY;

const maybe = token ? describe : describe.skip;

maybe('FigmaClient (live)', () => {
  it('GET /v1/me returns a user handle', async () => {
    const client = new FigmaClient({ proxy: {} });
    try {
      const me = await client.me.get();
      expect(typeof me.id).toBe('string');
      expect(typeof me.handle).toBe('string');
      expect(me.handle.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  it('rejects a bogus token with FigmaAuthError', async () => {
    const client = new FigmaClient({ token: 'figd_invalid_token_12345', proxy: {} });
    try {
      await expect(client.me.get()).rejects.toBeInstanceOf(FigmaAuthError);
    } finally {
      await client.close();
    }
  });
});

const maybeFile = token && fileKey ? describe : describe.skip;

maybeFile('FigmaClient files (live)', () => {
  it('GET /v1/files/:key returns a file document', async () => {
    const client = new FigmaClient({ proxy: {} });
    try {
      const file = await client.files.get(fileKey as string, { depth: 1 });
      expect(typeof file.name).toBe('string');
      expect(typeof file.lastModified).toBe('string');
    } finally {
      await client.close();
    }
  });
});
