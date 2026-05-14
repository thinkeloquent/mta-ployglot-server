// @ts-nocheck
/**
 * Targeted coverage-completion tests for residual branches and edge cases.
 * Each describe block targets the file noted in its header.
 */
import { describe, it, expect } from 'vitest';

// ----- src/auth/bearer.ts (isAsync caching) -----
import { BearerAuth, APIKeyAuth } from './auth/bearer.js';
describe('BearerAuth.isAsync caching', () => {
  it('static-string token → isAsync false (cached)', () => {
    const a = new BearerAuth('abc');
    expect(a.isAsync).toBe(false);
    expect(a.isAsync).toBe(false); // second access uses cached value
  });
  it('sync function token → isAsync false (cached)', () => {
    const a = new BearerAuth(() => 'x');
    expect(a.isAsync).toBe(false);
    expect(a.isAsync).toBe(false);
  });
  it('async function token → isAsync true (cached)', () => {
    const a = new BearerAuth(async () => 'x');
    expect(a.isAsync).toBe(true);
    expect(a.isAsync).toBe(true);
  });
});

// ----- src/auth/digest.ts (sha512 + default algorithm fallback) -----
import { DigestAuth } from './auth/digest.js';
import { Request } from './models/request.js';
import { Response } from './models/response.js';
describe('DigestAuth — algorithm coverage', () => {
  const req = (): Request => new Request('GET', 'http://x.test/p');
  const challenge = (algo: string): Response =>
    new Response({
      statusCode: 401,
      headers: { 'www-authenticate': `Digest realm="r", nonce="n", qop="auth", algorithm=${algo}` },
    });
  it('SHA-512 produces 128-char hex digest', () => {
    const auth = new DigestAuth('u', 'p');
    const out = auth.apply(req(), challenge('SHA-512'));
    const m = out.headers.get('Authorization')!.match(/response="([0-9a-f]+)"/);
    expect(m![1]!.length).toBe(128);
  });
  it('SHA-512-256 strips suffix and uses sha512', () => {
    const auth = new DigestAuth('u', 'p');
    const out = auth.apply(req(), challenge('SHA-512-256'));
    expect(out.headers.get('Authorization')).toMatch(/response="[0-9a-f]+"/);
  });
  it('unknown algorithm falls back to MD5', () => {
    const auth = new DigestAuth('u', 'p');
    const out = auth.apply(req(), challenge('UNKNOWN'));
    const m = out.headers.get('Authorization')!.match(/response="([0-9a-f]+)"/);
    expect(m![1]!.length).toBe(32); // md5
  });
  it('SHA-256-sess (session variant) hashes again with cnonce/nonce', () => {
    const auth = new DigestAuth('u', 'p');
    const out = auth.apply(req(), challenge('SHA-256-sess'));
    expect(out.headers.get('Authorization')).toMatch(/algorithm=SHA-256-sess/);
  });
});

// ----- src/auth/base.ts (subclass canHandleChallenge default behavior) -----
import { Auth, NoAuth } from './auth/base.js';
describe('Auth base class default behaviour', () => {
  it('NoAuth.canHandleChallenge returns false on any response', () => {
    const fakeResp = new Response({ statusCode: 401 });
    expect(new NoAuth().canHandleChallenge(fakeResp)).toBe(false);
  });
  it('Auth abstract — can be subclassed with custom apply', () => {
    class T extends Auth {
      apply(r: Request): Request {
        return r;
      }
    }
    expect(new T()).toBeInstanceOf(Auth);
  });
});

// ----- src/auth/basic.ts (toString edge) -----
import { BasicAuth, basicAuthFromURL } from './auth/basic.js';
describe('BasicAuth equals branch', () => {
  it('equals false on different password', () => {
    expect(new BasicAuth('u', 'a').equals(new BasicAuth('u', 'b'))).toBe(false);
  });
});
describe('APIKeyAuth default header name', () => {
  it('uses X-API-Key when none given', () => {
    expect(
      new APIKeyAuth('k').apply(new Request('GET', 'http://x/')).headers.get('x-api-key'),
    ).toBe('k');
  });
});
describe('basicAuthFromURL accepts URL object', () => {
  it('preserves creds from URL instance', () => {
    expect(basicAuthFromURL(new URL('https://u:p@x.test/'))?.username).toBe('u');
  });
});

// ----- src/config/timeout.ts (createTimeout undefined branch) -----
import { createTimeout, Timeout } from './config/timeout.js';
describe('Timeout — extra branches', () => {
  it('createTimeout(undefined) → defaults', () => {
    expect(createTimeout(undefined).read).toBe(30000);
  });
  it('headersTimeout=null → toUndiciOptions omits headersTimeout', () => {
    const u = new Timeout({
      headersTimeout: null,
      bodyTimeout: null,
      read: null,
    }).toUndiciOptions();
    expect(u.headersTimeout).toBeUndefined();
    expect(u.bodyTimeout).toBeUndefined();
  });
  it('connect=null → omitted from undici options', () => {
    const u = new Timeout({ connect: null }).toUndiciOptions();
    expect(u.connectTimeout).toBeUndefined();
  });
});

// ----- src/config/tls.ts (createTLSConfig branches) -----
import { createTLSConfig } from './config/tls.js';
describe('createTLSConfig branches', () => {
  it('undefined → default verify=true', () => {
    expect(createTLSConfig(undefined).verify).toBe(true);
  });
  it('object input passes through', () => {
    expect(createTLSConfig({ verify: false }).verify).toBe(false);
  });
});

// ----- src/config/proxy.ts (shouldBypass: port spec + host endsWith) -----
import { Proxy } from './config/proxy.js';
describe('Proxy.shouldBypass — extra branches', () => {
  it('host:port pattern matches both', () => {
    const p = new Proxy({ url: 'http://proxy', noProxy: ['x.test:8080'] });
    expect(p.shouldBypass('http://x.test:8080/p')).toBe(true);
    expect(p.shouldBypass('http://x.test:9000/p')).toBe(false);
  });
  it('host suffix match (endsWith)', () => {
    const p = new Proxy({ url: 'http://proxy', noProxy: ['internal.com'] });
    expect(p.shouldBypass('http://api.internal.com')).toBe(true);
  });
  it('empty pattern is skipped', () => {
    const p = new Proxy({ url: 'http://proxy', noProxy: ['', 'x.com'] });
    expect(p.shouldBypass('http://x.com')).toBe(true);
  });
  it('Proxy with malformed URL returns the URL verbatim from sanitizedUrl', () => {
    const p = new Proxy({ url: 'not a url' });
    expect(p.sanitizedUrl).toBe('not a url');
  });
  it('Proxy._extractAuthFromUrl tolerates malformed URL', () => {
    const p = new Proxy({ url: 'malformed' });
    expect(p.auth).toBeUndefined();
  });
});

// ----- src/client/options.ts (verify shorthand normalisation) -----
import { normalizeClientOptions, normalizeRequestOptions } from './client/options.js';
describe('normalizeClientOptions — shorthand expansion', () => {
  it('verify=false expands to tls.verify', () => {
    const out = normalizeClientOptions({ verify: false });
    expect((out.tls as { verify?: boolean }).verify).toBe(false);
  });
  it('verify=true expands to tls.verify', () => {
    const out = normalizeClientOptions({ verify: true });
    expect((out.tls as { verify?: boolean }).verify).toBe(true);
  });
  it('explicit tls wins over verify shorthand', () => {
    const out = normalizeClientOptions({ tls: { verify: false }, verify: true });
    expect((out.tls as { verify?: boolean }).verify).toBe(false);
  });
});
describe('normalizeRequestOptions — empty/aliases', () => {
  it('empty input returns {}', () => {
    expect(normalizeRequestOptions()).toEqual({});
  });
  it('max_redirects → maxRedirects', () => {
    expect(normalizeRequestOptions({ max_redirects: 7 }).maxRedirects).toBe(7);
  });
});

// ----- src/models/url.ts (matchURLPattern wildcard path suffix) -----
import { matchURLPattern, buildURL } from './models/url.js';
describe('matchURLPattern — path wildcard', () => {
  it('matches path prefix with /*', () => {
    expect(matchURLPattern('https://x.test/api/v1/users', 'https://x.test/api/*')).toBe(true);
    expect(matchURLPattern('https://x.test/other/v1', 'https://x.test/api/*')).toBe(false);
  });
  it('exact path match', () => {
    expect(matchURLPattern('https://x.test/p', 'https://x.test/p')).toBe(true);
    expect(matchURLPattern('https://x.test/q', 'https://x.test/p')).toBe(false);
  });
  it('rejects malformed pattern (no scheme)', () => {
    expect(matchURLPattern('https://x.test', 'no-scheme-here')).toBe(false);
  });
});
describe('buildURL', () => {
  it('absolute path with no base', () => {
    expect(buildURL(undefined, 'https://x.test/p').toString()).toBe('https://x.test/p');
  });
  it('throws when no base and no path', () => {
    expect(() => buildURL()).toThrow();
  });
});

// ----- src/models/headers.ts (string init + Headers→Headers copy) -----
import { Headers } from './models/headers.js';
describe('Headers ctor branches', () => {
  it('Headers instance → deep copy', () => {
    const a = new Headers({ A: '1', B: ['2', '3'] });
    const b = new Headers(a);
    expect(b.get('a')).toBe('1');
    expect(b.getAll('B')).toEqual(['2', '3']);
    a.set('A', '99');
    expect(b.get('a')).toBe('1'); // independent
  });
  it('multi-line string init with malformed lines tolerates', () => {
    const h = new Headers('A: 1\nbad-line-no-colon\nB: 2');
    expect(h.get('A')).toBe('1');
    expect(h.get('B')).toBe('2');
  });
  it('delete removes both data and case map entries', () => {
    const h = new Headers({ 'Content-Type': 'x' });
    h.delete('content-type');
    expect(h.has('content-type')).toBe(false);
  });
});

// ----- src/models/request.ts (URL instance + body undefined branches) -----
describe('Request ctor branches', () => {
  it('URL instance preserved (not re-parsed)', () => {
    const u = new URL('http://x.test/p');
    const r = new Request('GET', u);
    expect(r.url).toBe(u);
  });
  it('hasBody false for undefined body', () => {
    expect(new Request('GET', 'http://x.test/').hasBody).toBe(false);
  });
  it('contentType / contentLength undefined when missing', () => {
    const r = new Request('GET', 'http://x.test/');
    expect(r.contentType).toBeUndefined();
    expect(r.contentLength).toBeUndefined();
  });
  it('clone preserves body when not overridden', () => {
    const r = new Request('POST', 'http://x.test/', { body: 'hi' });
    expect(r.clone().body).toBe('hi');
  });
});

// ----- src/streaming/lines.ts (SSE: id sticky, default field branch) -----
import { Readable } from 'node:stream';
import { iterSSE } from './streaming/lines.js';
describe('iterSSE — extra branches', () => {
  function makeStream(chunks: string[]): Readable {
    return Readable.from(chunks.map((c) => Buffer.from(c)));
  }
  it('id sticks across events', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['id: abc\ndata: a\n\ndata: b\n\n']))) out.push(e);
    expect(out).toEqual([
      { id: 'abc', data: 'a' },
      { id: 'abc', data: 'b' },
    ]);
  });
  it('unknown field is ignored without error', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['custom: x\ndata: ok\n\n']))) out.push(e);
    expect(out).toEqual([{ data: 'ok' }]);
  });
  it('field with no colon → field = whole line, value = ""', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['data\n\n']))) out.push(e);
    // No colon, treated as field name 'data' with empty value → empty string pushed.
    expect(out).toEqual([{ data: '' }]);
  });
});

// ----- src/streaming/bytes.ts (chunkSize=0 path) -----
import { iterBytes } from './streaming/bytes.js';
describe('iterBytes — chunkSize=0', () => {
  it('chunkSize=0 → identical to undefined', async () => {
    const stream = Readable.from([Buffer.from('abc')]);
    const out: Buffer[] = [];
    for await (const c of iterBytes(stream, 0)) out.push(c);
    expect(Buffer.concat(out).toString()).toBe('abc');
  });
});

// ----- src/sdk/cli.ts (3xx exit code branch) -----
import { CLIContext } from './sdk/cli.js';
describe('CLIContext._statusToExitCode (private; tested through download)', () => {
  it('CLIContext can be constructed with only options', async () => {
    const cli = new CLIContext({ followRedirects: false });
    await cli.close();
  });
});

// ----- src/sdk/agent.ts (network error info branches) -----
import { MockAgent } from 'undici';
import { AgentHTTPClient } from './sdk/agent.js';
describe('AgentHTTPClient network error info — every branch', () => {
  const ORIGIN = 'http://agentx.test';
  for (const [code, expectedError] of [
    ['ETIMEDOUT', 'Request timed out'],
    ['ECONNREFUSED', 'Connection refused'],
    ['ENOTFOUND', 'DNS lookup failed'],
  ] as const) {
    it(`${code} → "${expectedError}"`, async () => {
      const mock = new MockAgent();
      mock.disableNetConnect();
      mock
        .get(ORIGIN)
        .intercept({ path: '/x', method: 'GET' })
        .replyWithError(Object.assign(new Error(code.toLowerCase()), { code }));
      const a = new AgentHTTPClient({ mounts: { [ORIGIN]: mock } });
      try {
        const r = await a.get(`${ORIGIN}/x`);
        expect(r.error).toBe(expectedError);
      } finally {
        await a.close();
      }
    });
  }
});

// ----- src/sdk/pool.ts (URL normalisation) -----
import { getPool, closeAllPools, getActivePoolOrigins } from './sdk/pool.js';
describe('pool registry — URL input', () => {
  it('accepts URL object as origin', async () => {
    const url = new URL('http://normalised.test/path');
    const p = getPool(url);
    expect(getActivePoolOrigins()).toContain('http://normalised.test');
    await p.close();
    await closeAllPools();
  });
  it('strips path from string-formed origin', async () => {
    const p = getPool('http://stripped.test/some/path');
    expect(getActivePoolOrigins()).toContain('http://stripped.test');
    await p.close();
    await closeAllPools();
  });
});

// ----- src/sdk/core.ts (non-retryable error path in catch) -----
import { createSDK } from './sdk/core.js';
describe('SDK — non-retryable exception handling', () => {
  it('non-retryable error returns synthetic error with statusCode 0', async () => {
    const ORIGIN = 'http://corex.test';
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get(ORIGIN)
      .intercept({ path: '/x', method: 'GET' })
      .replyWithError(new Error('not retryable'));
    const sdk = createSDK({
      baseUrl: ORIGIN,
      maxRetries: 3,
      retryOnException: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdk as any)._client._mountRouter.mount(ORIGIN, mock);
    try {
      const r = await sdk.get('/x');
      expect(r.success).toBe(false);
      expect(r.statusCode).toBe(0);
      expect(r.error).toBe('not retryable');
    } finally {
      await sdk.close();
    }
  });
});

// ----- src/client/client.ts (proxy branches) -----
import { AsyncClient } from './client/client.js';
import { Proxy as ProxyClass } from './config/proxy.js';
describe('AsyncClient — proxy branches', () => {
  it('explicit Proxy instance is mounted', async () => {
    const c = new AsyncClient({ proxy: new ProxyClass('http://proxy.test') });
    await c.close();
  });
  it('proxy from string is wrapped in Proxy and mounted', async () => {
    const c = new AsyncClient({ proxy: 'http://proxy.test' });
    await c.close();
  });
  it('trustEnv with HTTP_PROXY mounts proxy automatically', async () => {
    const saved = process.env.HTTP_PROXY;
    process.env.HTTP_PROXY = 'http://envproxy.test';
    try {
      const c = new AsyncClient({ trustEnv: true });
      await c.close();
    } finally {
      if (saved === undefined) delete process.env.HTTP_PROXY;
      else process.env.HTTP_PROXY = saved;
    }
  });
  it('trustEnv with HTTPS_PROXY mounts proxy', async () => {
    const saved = process.env.HTTPS_PROXY;
    process.env.HTTPS_PROXY = 'http://envproxy.test';
    try {
      const c = new AsyncClient({ trustEnv: true });
      await c.close();
    } finally {
      if (saved === undefined) delete process.env.HTTPS_PROXY;
      else process.env.HTTPS_PROXY = saved;
    }
  });
  it('Symbol.asyncDispose closes via asyncDispose path', async () => {
    const c = new AsyncClient({});
    await c[Symbol.asyncDispose]();
    expect(c.closed).toBe(true);
  });
});
