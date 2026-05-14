// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeVersion,
  toJSON,
  fromJSON,
  parseEnvFile,
} from '../src/core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('normalizeVersion', () => {
  it('pads short versions', () => {
    expect(normalizeVersion('1.0')).toBe('1.0.0');
  });

  it('truncates long versions', () => {
    expect(normalizeVersion('1.2.3.4.5')).toBe('1.2.3');
  });
});

describe('toJSON / fromJSON', () => {
  it('round-trips a vault file with camelCase ↔ snake_case conversion', () => {
    const input = {
      header: { version: '1.0.0', createdAt: '2026-04-24T00:00:00.000Z' },
      secrets: { A: '1', B: '2' },
    };
    const serialised = toJSON(input as Parameters<typeof toJSON>[0]);
    expect(serialised).toContain('"created_at"');
    const round = fromJSON(serialised);
    expect(round.header.version).toBe('1.0.0');
    expect(round.secrets.A).toBe('1');
  });

  it('throws on empty input', () => {
    expect(() => fromJSON('')).toThrow('Invalid JSON input');
  });
});

describe('parseEnvFile', () => {
  it('handles quoted + single-quoted + commented lines', () => {
    const parsed = parseEnvFile(path.join(FIXTURES, '.env.mixed'));
    expect(parsed.SHARED).toBe('file-value');
    expect(parsed.FILE_ONLY).toBe('only-in-file');
    expect(parsed.QUOTED).toBe('wrapped in double quotes');
    expect(parsed.SINGLE_QUOTED).toBe('wrapped in single quotes');
  });

  it('returns empty map for missing file', () => {
    expect(parseEnvFile('/tmp/definitely-not-there.env')).toEqual({});
  });
});
