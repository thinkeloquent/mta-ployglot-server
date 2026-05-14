// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Auth, NoAuth, isAuth } from './base.js';
import { BasicAuth, basicAuthFromURL } from './basic.js';
import { BearerAuth, APIKeyAuth } from './bearer.js';
import { DigestAuth } from './digest.js';
import { Request } from '../models/request.js';

const req = () => new Request('GET', 'https://x.test/v1');

describe('NoAuth & isAuth', () => {
  it('NoAuth.apply is pass-through', () => {
    const r = req();
    expect(new NoAuth().apply(r)).toBe(r);
  });
  it('NoAuth requiresChallenge false', () => {
    expect(new NoAuth().requiresChallenge).toBe(false);
  });
  it('isAuth checks instance', () => {
    expect(isAuth(new NoAuth())).toBe(true);
    expect(isAuth({})).toBe(false);
    expect(isAuth(null)).toBe(false);
  });
  it('Auth is abstract', () => {
    expect(NoAuth.prototype).toBeInstanceOf(Auth);
  });
});

describe('BasicAuth', () => {
  it('precomputes token and applies header', () => {
    const a = new BasicAuth('u', 'p');
    const out = a.apply(req());
    const expected = 'Basic ' + Buffer.from('u:p').toString('base64');
    expect(out.headers.get('Authorization')).toBe(expected);
  });
  it('equals compares creds', () => {
    expect(new BasicAuth('a', 'b').equals(new BasicAuth('a', 'b'))).toBe(true);
    expect(new BasicAuth('a', 'b').equals(new BasicAuth('a', 'c'))).toBe(false);
  });
  it('basicAuthFromURL extracts creds', () => {
    const a = basicAuthFromURL('https://u:p@x.test/');
    expect(a).not.toBeNull();
    expect(a!.username).toBe('u');
    expect(basicAuthFromURL('https://x.test/')).toBeNull();
  });
});

describe('BearerAuth', () => {
  it('static token applies', () => {
    expect(new BearerAuth('abc').apply(req()).headers.get('authorization')).toBe('Bearer abc');
  });
  it('sync provider applies', () => {
    expect(new BearerAuth(() => 'xyz').apply(req()).headers.get('authorization')).toBe(
      'Bearer xyz',
    );
  });
  it('async provider throws on apply', () => {
    expect(() => new BearerAuth(async () => 'x').apply(req())).toThrow(/async/);
  });
  it('async provider works via applyAsync', async () => {
    const out = await new BearerAuth(async () => 'x').applyAsync(req());
    expect(out.headers.get('authorization')).toBe('Bearer x');
  });
});

describe('APIKeyAuth', () => {
  it('default header is X-API-Key', () => {
    expect(new APIKeyAuth('k').apply(req()).headers.get('x-api-key')).toBe('k');
  });
  it('custom header name', () => {
    expect(new APIKeyAuth('k', 'X-Token').apply(req()).headers.get('x-token')).toBe('k');
  });
});

describe('DigestAuth', () => {
  it('requiresChallenge true', () => {
    expect(new DigestAuth('u', 'p').requiresChallenge).toBe(true);
  });
  it('apply without challenge returns request unchanged', () => {
    const r = req();
    const a = new DigestAuth('u', 'p');
    expect(a.apply(r)).toBe(r);
  });
});
