// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Logger, LogLevel, setLogLevel, getLogger } from '../src/logger.js';

describe('Logger', () => {
  it('Logger.create returns an IVaultFileLogger', () => {
    const l = Logger.create('pkg', 'file');
    expect(typeof l.info).toBe('function');
    expect(typeof l.warn).toBe('function');
    expect(typeof l.error).toBe('function');
    expect(typeof l.debug).toBe('function');
  });

  it('getLogger returns a default logger', () => {
    expect(getLogger()).toBeDefined();
  });

  it('setLogLevel(NONE) suppresses output — smoke test that setter runs', () => {
    setLogLevel(LogLevel.NONE);
    getLogger().info('this should not appear');
    setLogLevel(LogLevel.DEBUG);
  });
});
