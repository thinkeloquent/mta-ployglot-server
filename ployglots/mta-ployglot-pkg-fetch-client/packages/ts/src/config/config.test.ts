// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Timeout, createTimeout } from './timeout.js';
import { Limits, createLimits } from './limits.js';
import { TLSConfig, createTLSConfig } from './tls.js';
import { Proxy, createProxy, getEnvProxy } from './proxy.js';

describe('Timeout', () => {
  it('uniform number sets all four', () => {
    const t = createTimeout(5000);
    expect(t.connect).toBe(5000);
    expect(t.read).toBe(5000);
    expect(t.write).toBe(5000);
    expect(t.pool).toBe(5000);
  });

  it('default ctor uses defaults', () => {
    const t = new Timeout();
    expect(t.connect).toBe(5000);
    expect(t.read).toBe(30000);
  });

  it('null disables a field', () => {
    const t = new Timeout({ read: null });
    expect(t.read).toBeNull();
  });

  it('isDisabled when all 3 core fields are null', () => {
    expect(new Timeout({ connect: null, read: null, write: null }).isDisabled).toBe(true);
  });

  it('merge per-field override', () => {
    expect(new Timeout({ read: 5000 }).merge({ read: 10000 }).read).toBe(10000);
  });

  it('toUndiciOptions emits headersTimeout / bodyTimeout / connectTimeout', () => {
    const out = new Timeout({ headersTimeout: 100 }).toUndiciOptions();
    expect(out.headersTimeout).toBe(100);
    expect(out.connectTimeout).toBe(5000);
  });
});

describe('Limits', () => {
  it('defaults', () => {
    const l = new Limits();
    expect(l.maxConnections).toBe(100);
    expect(l.maxConnectionsPerHost).toBe(20);
    expect(l.keepAliveTimeout).toBe(4000);
  });

  it('overrides', () => {
    expect(new Limits({ maxConnections: 50 }).maxConnections).toBe(50);
    expect(new Limits({ pipelining: 10 }).pipelining).toBe(10);
  });

  it('toUndiciPoolOptions maps connections', () => {
    const opts = new Limits({ maxConnections: 25 }).toUndiciPoolOptions();
    expect(opts.connections).toBe(25);
  });

  it('createLimits factory', () => {
    expect(createLimits()).toBeInstanceOf(Limits);
  });
});

describe('TLSConfig', () => {
  it('boolean shorthand', () => {
    expect(createTLSConfig(true).verify).toBe(true);
    expect(createTLSConfig(false).verify).toBe(false);
  });

  it('isMTLS requires both cert and key', () => {
    expect(new TLSConfig({ cert: 'c', key: 'k' }).isMTLS).toBe(true);
    expect(new TLSConfig({ cert: 'c' }).isMTLS).toBe(false);
  });

  it('toUndiciOptions maps verify → rejectUnauthorized, sni → servername', () => {
    const out = new TLSConfig({ verify: false, sni: 'api.example.com' }).toUndiciOptions();
    expect(out.rejectUnauthorized).toBe(false);
    expect(out.servername).toBe('api.example.com');
  });

  it('alpnProtocols → ALPNProtocols', () => {
    const out = new TLSConfig({ alpnProtocols: ['h2'] }).toUndiciOptions();
    expect(out.ALPNProtocols).toEqual(['h2']);
  });
});

describe('Proxy + env discovery', () => {
  let savedHttp: string | undefined;
  let savedHttps: string | undefined;
  let savedNo: string | undefined;
  beforeEach(() => {
    savedHttp = process.env.HTTP_PROXY;
    savedHttps = process.env.HTTPS_PROXY;
    savedNo = process.env.NO_PROXY;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
  });
  afterEach(() => {
    if (savedHttp === undefined) delete process.env.HTTP_PROXY;
    else process.env.HTTP_PROXY = savedHttp;
    if (savedHttps === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = savedHttps;
    if (savedNo === undefined) delete process.env.NO_PROXY;
    else process.env.NO_PROXY = savedNo;
  });

  it('Proxy from string url', () => {
    const p = new Proxy('http://proxy.x:8080');
    expect(p.url).toBe('http://proxy.x:8080');
  });

  it('extracts userinfo from url', () => {
    const p = new Proxy('http://u:p@proxy.x:8080');
    expect(p.auth?.username).toBe('u');
    expect(p.auth?.password).toBe('p');
  });

  it('sanitizedUrl strips creds', () => {
    const p = new Proxy('http://u:p@proxy.x:8080');
    expect(p.sanitizedUrl).not.toContain('u:p@');
  });

  it('explicit auth wins over url userinfo', () => {
    const p = new Proxy({
      url: 'http://u:p@proxy.x',
      auth: { username: 'over', password: 'ride' },
    });
    expect(p.auth?.username).toBe('over');
  });

  it('toUndiciOptions emits Basic token when auth present', () => {
    const out = new Proxy({
      url: 'http://proxy.x',
      auth: { username: 'u', password: 'p' },
    }).toUndiciOptions();
    expect(out.token).toBe('Basic ' + Buffer.from('u:p').toString('base64'));
  });

  it('shouldBypass exact host match', () => {
    const p = new Proxy({ url: 'http://proxy', noProxy: ['example.com'] });
    expect(p.shouldBypass('http://example.com')).toBe(true);
    expect(p.shouldBypass('http://other.com')).toBe(false);
  });

  it('shouldBypass wildcard subdomain', () => {
    const p = new Proxy({ url: 'http://proxy', noProxy: ['*.internal.com'] });
    expect(p.shouldBypass('http://api.internal.com')).toBe(true);
    expect(p.shouldBypass('http://internal.com')).toBe(true);
    expect(p.shouldBypass('http://other.com')).toBe(false);
  });

  it('shouldBypass star catch-all', () => {
    expect(new Proxy({ url: 'http://proxy', noProxy: ['*'] }).shouldBypass('http://any')).toBe(
      true,
    );
  });

  it('getEnvProxy reads HTTP_PROXY', () => {
    process.env.HTTP_PROXY = 'http://proxy.x:8080';
    expect(getEnvProxy().http?.url).toBe('http://proxy.x:8080');
    expect(getEnvProxy().https).toBeUndefined();
  });

  it('getEnvProxy applies NO_PROXY to both', () => {
    process.env.HTTP_PROXY = 'http://p';
    process.env.HTTPS_PROXY = 'http://p';
    process.env.NO_PROXY = '.internal.com,localhost';
    const env = getEnvProxy();
    expect(env.http?.noProxy).toEqual(['.internal.com', 'localhost']);
    expect(env.https?.noProxy).toEqual(['.internal.com', 'localhost']);
  });

  it('getEnvProxy returns empty when no env set', () => {
    expect(getEnvProxy()).toEqual({});
  });

  it('createProxy(undefined) returns undefined', () => {
    expect(createProxy(undefined)).toBeUndefined();
  });
});
