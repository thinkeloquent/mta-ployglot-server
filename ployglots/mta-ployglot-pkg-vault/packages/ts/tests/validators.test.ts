// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { EnvKeyNotFoundError } from '../src/validators.js';

describe('EnvKeyNotFoundError', () => {
  it('has .key attribute', () => {
    const e = new EnvKeyNotFoundError('FOO');
    expect(e.key).toBe('FOO');
  });

  it('message matches canonical format', () => {
    const e = new EnvKeyNotFoundError('FOO');
    expect(e.message).toBe("Environment variable 'FOO' not found");
  });

  it('instanceof Error and name set', () => {
    const e = new EnvKeyNotFoundError('FOO');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('EnvKeyNotFoundError');
  });
});
