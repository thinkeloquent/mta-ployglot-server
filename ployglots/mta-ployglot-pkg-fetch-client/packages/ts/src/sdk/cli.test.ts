// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockAgent } from 'undici';
import { CLIContext, createCLIContext } from './cli.js';

const ORIGIN = 'http://cli.test';
let tmpFile: string;

beforeEach(() => {
  tmpFile = join(tmpdir(), `cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
});
afterEach(() => {
  if (existsSync(tmpFile)) unlinkSync(tmpFile);
});

describe('CLIContext.download — happy path', () => {
  it('writes 200 body to disk and reports 0 exit code', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/file', method: 'GET' })
      .reply(200, 'binary-content', { headers: { 'content-length': '14' } });
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      const result = await cli.download(`${ORIGIN}/file`, { output: tmpFile });
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.exitCode).toBe(0);
      expect(result.outputPath).toBe(tmpFile);
      expect(result.bytesDownloaded).toBe(14);
      expect(readFileSync(tmpFile, 'utf-8')).toBe('binary-content');
    } finally {
      await cli.close();
    }
  });

  it('invokes onProgress callback per chunk', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/file', method: 'GET' })
      .reply(200, 'abcdef', { headers: { 'content-length': '6' } });
    const calls: Array<[number, number | undefined]> = [];
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      await cli.download(`${ORIGIN}/file`, {
        output: tmpFile,
        onProgress: (b, t) => calls.push([b, t]),
      });
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1]![0]).toBe(6);
    } finally {
      await cli.close();
    }
  });
});

describe('CLIContext.download — error paths', () => {
  it('404 returns success: false with exitCode 4', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/missing', method: 'GET' }).reply(404, '');
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await cli.download(`${ORIGIN}/missing`, { output: tmpFile });
      expect(r.success).toBe(false);
      expect(r.statusCode).toBe(404);
      expect(r.exitCode).toBe(4);
    } finally {
      await cli.close();
    }
  });

  it('503 returns exitCode 5', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/down', method: 'GET' }).reply(503, '');
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await cli.download(`${ORIGIN}/down`, { output: tmpFile });
      expect(r.exitCode).toBe(5);
    } finally {
      await cli.close();
    }
  });

  it('network error returns exitCode 1 with statusCode 0', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(Object.assign(new Error('fail'), { code: 'ECONNREFUSED' }));
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await cli.download(`${ORIGIN}/x`, { output: tmpFile });
      expect(r.success).toBe(false);
      expect(r.statusCode).toBe(0);
      expect(r.exitCode).toBe(1);
    } finally {
      await cli.close();
    }
  });
});

describe('CLIContext.streamToStdout', () => {
  it('yields per-chunk byte counts', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/s', method: 'GET' }).reply(200, 'hello');
    const cli = new CLIContext({ mounts: { [ORIGIN]: mock } });
    try {
      let total = 0;
      for await (const n of cli.streamToStdout('GET', `${ORIGIN}/s`)) {
        total += n;
      }
      expect(total).toBe(5);
    } finally {
      await cli.close();
    }
  });
});

describe('createCLIContext factory', () => {
  it('returns a fresh CLIContext', async () => {
    const cli = createCLIContext({ baseUrl: ORIGIN });
    expect(cli).toBeInstanceOf(CLIContext);
    await cli.close();
  });
});
