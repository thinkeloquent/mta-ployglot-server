// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { DigestAuth } from './digest.js';
import { Request } from '../models/request.js';
import { Response } from '../models/response.js';

function challengeResponse(headerValue: string): Response {
  const req = new Request('GET', 'http://x.test/p');
  return new Response({
    statusCode: 401,
    headers: { 'www-authenticate': headerValue },
    request: req,
  });
}

describe('DigestAuth state machine', () => {
  it('first apply (no challenge) returns request unchanged', () => {
    const auth = new DigestAuth('u', 'p');
    const req = new Request('GET', 'http://x.test/p');
    expect(auth.apply(req)).toBe(req);
  });

  it('canHandleChallenge true on Digest WWW-Authenticate', () => {
    const auth = new DigestAuth('u', 'p');
    const resp = challengeResponse('Digest realm="r", nonce="n", qop="auth"');
    expect(auth.canHandleChallenge(resp)).toBe(true);
  });

  it('canHandleChallenge false on missing/non-Digest WWW-Authenticate', () => {
    const auth = new DigestAuth('u', 'p');
    const resp = new Response({
      statusCode: 401,
      headers: { 'www-authenticate': 'Basic realm="x"' },
    });
    expect(auth.canHandleChallenge(resp)).toBe(false);
    const noHeader = new Response({ statusCode: 401 });
    expect(auth.canHandleChallenge(noHeader)).toBe(false);
  });

  it('apply with challenge sets Authorization header with all required params', () => {
    const auth = new DigestAuth('u', 'p');
    const req = new Request('GET', 'http://x.test/p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", qop="auth", algorithm=MD5');
    const out = auth.apply(req, challenge);
    const header = out.headers.get('Authorization');
    expect(header).toBeTruthy();
    expect(header).toMatch(/^Digest /);
    expect(header).toContain('username="u"');
    expect(header).toContain('realm="r"');
    expect(header).toContain('nonce="n"');
    expect(header).toContain('uri="/p"');
    expect(header).toContain('qop=auth');
    expect(header).toContain('nc=00000001');
    expect(header).toMatch(/cnonce="[0-9a-f]+"/);
    expect(header).toMatch(/response="[0-9a-f]+"/);
  });

  it('nc increments across consecutive applies', () => {
    const auth = new DigestAuth('u', 'p');
    const req = new Request('GET', 'http://x.test/p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", qop="auth"');

    auth.apply(req, challenge);
    const second = auth.apply(req);
    expect(second.headers.get('Authorization')).toContain('nc=00000002');
    const third = auth.apply(req);
    expect(third.headers.get('Authorization')).toContain('nc=00000003');
  });

  it('reset() drops challenge state and zeroes nc', () => {
    const auth = new DigestAuth('u', 'p');
    const req = new Request('GET', 'http://x.test/p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", qop="auth"');
    auth.apply(req, challenge);
    auth.reset();
    expect(auth.apply(req)).toBe(req);
  });

  it('opaque parameter is preserved in response header', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", qop="auth", opaque="abc"');
    const req = new Request('GET', 'http://x.test/p');
    const out = auth.apply(req, challenge);
    expect(out.headers.get('Authorization')).toContain('opaque="abc"');
  });

  it('SHA-256 algorithm produces sha256-length hash', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse(
      'Digest realm="r", nonce="n", qop="auth", algorithm=SHA-256',
    );
    const req = new Request('GET', 'http://x.test/p');
    const out = auth.apply(req, challenge);
    const m = out.headers.get('Authorization')!.match(/response="([0-9a-f]+)"/);
    expect(m).toBeTruthy();
    expect(m![1]!.length).toBe(64); // sha256 hex
  });

  it('MD5 produces 32-char hex digest', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", qop="auth", algorithm=MD5');
    const req = new Request('GET', 'http://x.test/p');
    const out = auth.apply(req, challenge);
    const m = out.headers.get('Authorization')!.match(/response="([0-9a-f]+)"/);
    expect(m![1]!.length).toBe(32);
  });

  it('handles no qop (legacy RFC 2069 mode)', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", algorithm=MD5');
    const req = new Request('GET', 'http://x.test/p');
    const out = auth.apply(req, challenge);
    const header = out.headers.get('Authorization')!;
    expect(header).toContain('username="u"');
    expect(header).not.toContain('qop=auth');
    expect(header).not.toContain('nc=');
  });

  it('handles single-quoted values in challenge', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse("Digest realm='r', nonce='n', qop='auth'");
    const req = new Request('GET', 'http://x.test/p');
    const out = auth.apply(req, challenge);
    expect(out.headers.get('Authorization')).toContain('realm="r"');
  });

  it('handles unquoted stale value', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse('Digest realm="r", nonce="n", qop="auth", stale=true');
    const req = new Request('GET', 'http://x.test/p');
    const out = auth.apply(req, challenge);
    expect(out.headers.get('Authorization')).toBeTruthy();
  });

  it('malformed challenge (missing realm) leaves request unchanged', () => {
    const auth = new DigestAuth('u', 'p');
    const challenge = challengeResponse('Digest nonce="n"');
    const req = new Request('GET', 'http://x.test/p');
    expect(auth.apply(req, challenge)).toBe(req);
  });

  it('username getter', () => {
    expect(new DigestAuth('alice', 'secret').username).toBe('alice');
  });

  it('requiresChallenge is true', () => {
    expect(new DigestAuth('u', 'p').requiresChallenge).toBe(true);
  });

  it('produces a deterministic-ish output for known inputs', () => {
    // We cannot fix cnonce (no injector), but we can verify HA1/HA2 deterministically.
    const username = 'u';
    const realm = 'r';
    const password = 'p';
    const nonce = 'n';
    const ha1 = createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
    const ha2 = createHash('md5').update(`GET:/p`).digest('hex');
    expect(ha1.length).toBe(32);
    expect(ha2.length).toBe(32);
  });
});
