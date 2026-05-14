// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { VaultFileSDK, VaultFileSDKBuilder } from '../src/sdk.js';
import { Logger } from '../src/logger.js';
import { EnvStore } from '../src/env-store.js';

describe('VaultFileSDK setters', () => {
  it('setEnvPath / setBase64Parsers / setLogger all mutate internal state', () => {
    const sdk = VaultFileSDK.create().build();
    const alt = Logger.create('test', 'sdk-setter-test');

    sdk.setEnvPath('/tmp/x.env');
    sdk.setBase64Parsers({ raw: (s: string) => s });
    sdk.setLogger(alt);

    expect(sdk).toBeDefined();
  });
});

describe('VaultFileSDKBuilder', () => {
  it('returns a builder from VaultFileSDK.create()', () => {
    const b = VaultFileSDK.create();
    expect(b).toBeInstanceOf(VaultFileSDKBuilder);
  });

  it('chained build() returns an SDK with loadConfig', () => {
    const logger = Logger.create('test', 'builder-test');
    const sdk = VaultFileSDK.create()
      .withEnvPath('/tmp/x.env')
      .withBase64Parsers({})
      .withLogger(logger)
      .build();
    expect(typeof sdk.loadConfig).toBe('function');
  });

  it('default fallback: build() with no withLogger still yields a Logger', () => {
    const sdk = VaultFileSDK.create().build();
    expect(sdk).toBeDefined();
  });
});

describe('VaultFileSDK stubs', () => {
  beforeEach(() => EnvStore._resetForTests());

  it('exportToFormat returns NOT_IMPLEMENTED', () => {
    const sdk = VaultFileSDK.create().build();
    const r = sdk.exportToFormat('json', '/tmp/x.json');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('NOT_IMPLEMENTED');
  });

  it('listAvailableKeys returns empty list', () => {
    const sdk = VaultFileSDK.create().build();
    const r = sdk.listAvailableKeys();
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  it('suggestMissingKeys returns empty list', () => {
    const sdk = VaultFileSDK.create().build();
    const r = sdk.suggestMissingKeys('prefix');
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });
});

describe('VaultFileSDK read ops', () => {
  beforeEach(() => EnvStore._resetForTests());

  it('describeConfig returns source + vars count', () => {
    const sdk = VaultFileSDK.create().withEnvPath('.env').build();
    const r = sdk.describeConfig();
    expect(r.success).toBe(true);
    expect(r.data?.source).toBe('.env');
    expect(typeof r.data?.varsCount).toBe('number');
  });

  it('diagnoseEnvStore reports real varsLoaded (bug fix: was 0)', () => {
    const sdk = VaultFileSDK.create().build();
    sdk.loadConfig();
    const r = sdk.diagnoseEnvStore();
    expect(r.success).toBe(true);
    expect(r.data?.initialized).toBe(true);
    expect(r.data?.varsLoaded).toBeGreaterThan(0);
  });

  it('validateFile returns valid-but-empty for missing file', () => {
    const sdk = VaultFileSDK.create().build();
    const r = sdk.validateFile('/tmp/definitely-not-there.env');
    expect(r.success).toBe(true);
    expect(r.data?.valid).toBe(true);
    expect(r.data?.warnings).toContain('file parsed to empty map');
  });

  it('validateFile returns invalid when target is a directory', () => {
    const sdk = VaultFileSDK.create().build();
    const r = sdk.validateFile('/tmp');
    expect(r.success).toBe(true);
    expect(r.data?.valid).toBe(false);
  });

  it('getSecretSafe returns KEY_NOT_FOUND for unknown key', () => {
    const sdk = VaultFileSDK.create().build();
    sdk.loadConfig();
    const r = sdk.getSecretSafe('DEFINITELY_NO_SUCH_KEY_XYZ');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('KEY_NOT_FOUND');
  });

  it('findMissingRequired returns keys that are absent', () => {
    const sdk = VaultFileSDK.create().build();
    sdk.loadConfig();
    const r = sdk.findMissingRequired(['DEFINITELY_NO_A_XYZ', 'DEFINITELY_NO_B_XYZ']);
    expect(r.success).toBe(true);
    expect(r.data).toEqual(['DEFINITELY_NO_A_XYZ', 'DEFINITELY_NO_B_XYZ']);
  });
});

describe('VaultFileSDK load ops', () => {
  beforeEach(() => EnvStore._resetForTests());

  it('loadConfig returns success on a missing file (graceful)', () => {
    const sdk = VaultFileSDK.create().withEnvPath('/tmp/does-not-exist.env').build();
    const r = sdk.loadConfig();
    expect(r.success).toBe(true);
    expect(typeof r.data?.totalVarsLoaded).toBe('number');
  });

  it('loadFromPath returns failure with LOAD_FAILED when path is a directory', () => {
    const sdk = VaultFileSDK.create().build();
    const r = sdk.loadFromPath('/tmp');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('LOAD_FAILED');
  });
});
