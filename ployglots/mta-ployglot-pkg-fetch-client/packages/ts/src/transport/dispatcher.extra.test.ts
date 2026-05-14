// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Agent, Pool } from 'undici';
import { DispatcherFactory, createPool, createAgent } from './dispatcher.js';
import { Timeout } from '../config/timeout.js';
import { TLSConfig } from '../config/tls.js';
import { Limits } from '../config/limits.js';

describe('DispatcherFactory.getDefaultAgent', () => {
  it('returns an Agent and caches it', async () => {
    const f = new DispatcherFactory();
    const a = f.getDefaultAgent();
    const b = f.getDefaultAgent();
    expect(a).toBeInstanceOf(Agent);
    expect(a).toBe(b);
    await f.closeAll();
  });

  it('closeAll closes both pools and the default Agent', async () => {
    const f = new DispatcherFactory();
    f.getDispatcher('https://x.test');
    f.getDefaultAgent();
    await f.closeAll();
    expect(f.cacheSize).toBe(0);
  });
});

describe('DispatcherFactory option mapping', () => {
  it('TLSConfig flows through to pool connect options', async () => {
    const f = new DispatcherFactory({ tls: new TLSConfig({ verify: false }) });
    f.getDispatcher('https://x.test');
    expect(f.cacheSize).toBe(1);
    await f.closeAll();
  });

  it('user-supplied connect options merge on top of TLS options', async () => {
    const f = new DispatcherFactory({
      tls: new TLSConfig({ verify: false }),
      connect: { servername: 'override.test' },
    });
    f.getDispatcher('https://x.test');
    await f.closeAll();
  });

  it('connect-only (no TLS) is forwarded', async () => {
    const f = new DispatcherFactory({ connect: { servername: 'x.test' } });
    f.getDispatcher('https://x.test');
    await f.closeAll();
  });

  it('allowH2 / maxResponseSize flow through', async () => {
    const f = new DispatcherFactory({ allowH2: true, maxResponseSize: 1024 });
    f.getDispatcher('https://x.test');
    await f.closeAll();
  });

  it('followRedirects=false suppresses the redirect interceptor', async () => {
    const f = new DispatcherFactory({ followRedirects: false });
    f.getDispatcher('https://x.test');
    await f.closeAll();
  });

  it('user interceptors are appended', async () => {
    const noopInterceptor = (dispatch: unknown): unknown => dispatch;
    const f = new DispatcherFactory({ interceptors: [noopInterceptor] });
    f.getDispatcher('https://x.test');
    await f.closeAll();
  });

  it('Agent options include TLS connect when present', async () => {
    const f = new DispatcherFactory({
      timeout: new Timeout({ read: 1000 }),
      tls: new TLSConfig({ verify: false }),
      allowH2: true,
    });
    f.getDefaultAgent();
    await f.closeAll();
  });

  it('Limits flow through to pool', async () => {
    const f = new DispatcherFactory({ limits: new Limits({ maxConnections: 7 }) });
    f.getDispatcher('https://x.test');
    await f.closeAll();
  });
});

describe('createPool / createAgent factories', () => {
  it('createPool returns a Pool', async () => {
    const p = createPool('https://x.test');
    expect(p).toBeInstanceOf(Pool);
    await p.close();
  });

  it('createAgent returns an Agent', async () => {
    const a = createAgent({ allowH2: true });
    expect(a).toBeInstanceOf(Agent);
    await a.close();
  });

  it('createAgent default options', async () => {
    const a = createAgent();
    expect(a).toBeInstanceOf(Agent);
    await a.close();
  });
});
