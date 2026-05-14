// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as pkg from '../src/index.js';

describe('public barrel surface', () => {
  it('exports every documented public name', () => {
    const names = [
      'EnvKeyNotFoundError',
      'EnvStore',
      'Logger',
      'LogLevel',
      'VaultFileSDK',
      'VaultFileSDKBuilder',
      'VaultFileSchema',
      'VaultHeaderSchema',
      'getLogger',
      'makeSDKError',
      'setLogLevel',
      'normalizeVersion',
      'toJSON',
      'fromJSON',
      'parseEnvFile',
    ];
    for (const name of names) {
      expect((pkg as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});
