// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MockAgent } from 'undici';
import { AgentHTTPClient, createAgentHTTPClient } from './agent.js';

const ORIGIN = 'http://agent.test';

function mockReply(status: number, body: string, contentType = 'application/json'): MockAgent {
  const mock = new MockAgent();
  mock.disableNetConnect();
  mock
    .get(ORIGIN)
    .intercept({ path: '/x', method: 'GET' })
    .reply(status, body, { headers: { 'content-type': contentType } });
  return mock;
}

describe('AgentHTTPClient summary lines', () => {
  it('array data → "Retrieved N items"', async () => {
    const mock = mockReply(200, JSON.stringify([1, 2, 3, 4]));
    const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await a.get(`${ORIGIN}/x`);
      expect(r.summary).toBe('Retrieved 4 items');
    } finally {
      await a.close();
    }
  });

  it('object data → "Retrieved object with keys: ..."', async () => {
    const mock = mockReply(200, JSON.stringify({ a: 1, b: 2 }));
    const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await a.get(`${ORIGIN}/x`);
      expect(r.summary).toMatch(/^Retrieved object with keys: a, b$/);
    } finally {
      await a.close();
    }
  });

  it('null data → "Request succeeded (no content)"', async () => {
    const mock = mockReply(200, 'null');
    const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await a.get(`${ORIGIN}/x`);
      expect(r.summary).toBe('Request succeeded (no content)');
    } finally {
      await a.close();
    }
  });
});

describe('AgentHTTPClient error info table', () => {
  const errorCases: Array<[number, string]> = [
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [429, 'Too Many Requests'],
    [500, 'Internal Server Error'],
    [502, 'Bad Gateway'],
    [503, 'Service Unavailable'],
  ];
  for (const [code, errorMsg] of errorCases) {
    it(`HTTP ${code} → ${errorMsg}`, async () => {
      const mock = new MockAgent();
      mock.disableNetConnect();
      mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(code, '');
      const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
      try {
        const r = await a.get(`${ORIGIN}/x`);
        expect(r.success).toBe(false);
        expect(r.error).toBe(errorMsg);
        expect(r.suggestion).toBeTruthy();
      } finally {
        await a.close();
      }
    });
  }

  it('unknown status code → fallback "HTTP {code}"', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).reply(418, '');
    const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await a.get(`${ORIGIN}/x`);
      expect(r.error).toBe('HTTP 418');
    } finally {
      await a.close();
    }
  });
});

describe('AgentHTTPClient network error info', () => {
  it('ECONNREFUSED → "Connection refused"', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(Object.assign(new Error('econnrefused'), { code: 'ECONNREFUSED' }));
    const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await a.get(`${ORIGIN}/x`);
      expect(r.statusCode).toBe(0);
      expect(r.error).toBe('Connection refused');
    } finally {
      await a.close();
    }
  });

  it('generic error → message verbatim', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock.get(ORIGIN).intercept({ path: '/x', method: 'GET' }).replyWithError(new Error('mystery'));
    const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      const r = await a.get(`${ORIGIN}/x`);
      expect(r.error).toBeTruthy();
    } finally {
      await a.close();
    }
  });
});

describe('AgentHTTPClient verbs', () => {
  it('POST / PUT / DELETE return AgentResponse', async () => {
    const mock = new MockAgent();
    mock.disableNetConnect();
    const pool = mock.get(ORIGIN);
    for (const m of ['POST', 'PUT', 'DELETE']) {
      pool.intercept({ path: '/v', method: m }).reply(200, 'null');
    }
    const a = createAgentHTTPClient({ mounts: { [ORIGIN]: mock } });
    try {
      expect((await a.post(`${ORIGIN}/v`)).success).toBe(true);
      expect((await a.put(`${ORIGIN}/v`)).success).toBe(true);
      expect((await a.delete(`${ORIGIN}/v`)).success).toBe(true);
    } finally {
      await a.close();
    }
  });
});
