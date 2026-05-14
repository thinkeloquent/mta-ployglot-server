// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { EnvStore } from '../src/env-store.js';
import { EnvKeyNotFoundError } from '../src/validators.js';

describe('onStartup branching', () => {
  beforeEach(() => {
    EnvStore._resetForTests();
  });

  it('continues with empty store on missing file', () => {
    const r = EnvStore.onStartup('/tmp/definitely-not-there.env');
    expect(r.totalVarsLoaded).toBeGreaterThanOrEqual(Object.keys(process.env).length);
    expect(EnvStore.isInitialized()).toBe(true);
  });

  it('re-throws parse error when target is a directory', () => {
    expect(() => EnvStore.onStartup('/tmp')).toThrow();
  });

  it('onStartupAsync returns a Promise<LoadResult>', async () => {
    const p = EnvStore.onStartupAsync('/tmp/definitely-not-there.env');
    expect(p).toBeInstanceOf(Promise);
    const r = await p;
    expect(typeof r.totalVarsLoaded).toBe('number');
  });
});

describe('get (vault-wins priority)', () => {
  beforeEach(() => EnvStore._resetForTests());

  it('returns process.env value when store is empty', () => {
    process.env.TEST_ENV_ONLY_KEY = 'from-env';
    EnvStore.onStartup('/tmp/x.env');
    expect(EnvStore.get('TEST_ENV_ONLY_KEY')).toBe('from-env');
    delete process.env.TEST_ENV_ONLY_KEY;
  });

  it('returns default when neither store nor env has the key', () => {
    EnvStore.onStartup('/tmp/x.env');
    expect(EnvStore.get('DEFINITELY_UNSET_KEY', 'fallback')).toBe('fallback');
  });
});

describe('getOrThrow', () => {
  beforeEach(() => EnvStore._resetForTests());

  it('empty key throws with exact message', () => {
    expect(() => EnvStore.getOrThrow('')).toThrowError('Key is required');
  });

  it('missing key throws EnvKeyNotFoundError with .key set', () => {
    EnvStore.onStartup('/tmp/x.env');
    try {
      EnvStore.getOrThrow('DEFINITELY_NOT_SET_XYZ');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvKeyNotFoundError);
      expect((err as EnvKeyNotFoundError).key).toBe('DEFINITELY_NOT_SET_XYZ');
    }
  });
});

describe('isInitialized', () => {
  beforeEach(() => EnvStore._resetForTests());

  it('returns false before onStartup', () => {
    expect(EnvStore.isInitialized()).toBe(false);
  });

  it('returns true after onStartup (even when file is missing)', () => {
    EnvStore.onStartup('/tmp/does-not-exist.env');
    expect(EnvStore.isInitialized()).toBe(true);
  });
});
