// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import {
  EnvStore,
  VaultFileSDK,
  VaultFileSchema,
  fromJSON,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('Parity invariants — TS', () => {
  beforeAll(() => {
    process.env.SHARED = 'env-value';
    EnvStore._resetForTests();
    EnvStore.onStartup(path.join(FIXTURES, '.env.mixed'));
  });

  afterAll(() => {
    delete process.env.SHARED;
    EnvStore._resetForTests();
  });

  it('1. EnvStore.get priority: store wins over process.env', () => {
    expect(EnvStore.get('SHARED')).toBe('file-value');
  });

  it('2. onStartup is synchronous (no Promise)', () => {
    const r = EnvStore.onStartup(path.join(FIXTURES, '.env.mixed'));
    expect(r).not.toBeInstanceOf(Promise);
    expect(typeof r.totalVarsLoaded).toBe('number');
  });

  it('3. LoadResult JSON wire uses camelCase totalVarsLoaded', () => {
    const r = EnvStore.onStartup(path.join(FIXTURES, '.env.mixed'));
    expect(JSON.stringify(r)).toMatch(/"totalVarsLoaded":/);
  });

  it('4. fromJSON returns a validated VaultFile (not any)', () => {
    const raw = readFileSync(path.join(FIXTURES, 'vault.valid.json'), 'utf8');
    const vf = fromJSON(raw);
    expect(vf.header.version).toBe('1.0.0');
    expect(vf.secrets.SHARED).toBe('file-value');
  });

  it('5. EnvKeyNotFoundError exposes .key attribute', async () => {
    const { EnvKeyNotFoundError } = await import('../src/validators.js');
    const e = new EnvKeyNotFoundError('X');
    expect(e.key).toBe('X');
  });

  it('6. EnvKeyNotFoundError message matches canonical format', async () => {
    const { EnvKeyNotFoundError } = await import('../src/validators.js');
    expect(new EnvKeyNotFoundError('X').message).toBe("Environment variable 'X' not found");
  });

  it('7. SDKError is a named type with a helper constructor', async () => {
    const { makeSDKError } = await import('../src/sdk-types.js');
    const e = makeSDKError('C', 'M');
    expect(e.code).toBe('C');
    expect(e.message).toBe('M');
  });

  it('8. VaultFileSDKBuilder.withLogger exists and is chainable', () => {
    const sdk = VaultFileSDK.create()
      .withEnvPath('/x')
      .withLogger({
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      })
      .build();
    expect(sdk).toBeDefined();
  });

  it('9. VaultHeader.createdAt default is ms precision', () => {
    const h = VaultFileSchema.shape.header.parse({});
    expect(h.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('10. diagnoseEnvStore reports real varsLoaded (bug fix)', () => {
    const sdk = VaultFileSDK.create().build();
    sdk.setEnvPath(path.join(FIXTURES, '.env.mixed'));
    sdk.loadConfig();
    const r = sdk.diagnoseEnvStore();
    expect(r.success).toBe(true);
    expect(r.data!.varsLoaded).toBeGreaterThan(0);
  });

  it('11. No `dotenv` / `js-yaml` / `uuid` / `glob` at runtime', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).not.toContain('dotenv');
    expect(deps).not.toContain('js-yaml');
    expect(deps).not.toContain('uuid');
    expect(deps).not.toContain('glob');
  });

  it('12. No @ts-ignore in published src/', async () => {
    const fs = await import('node:fs');
    const srcDir = path.resolve(__dirname, '..', 'src');
    const srcFiles = fs.readdirSync(srcDir);
    for (const f of srcFiles) {
      if (!f.endsWith('.ts')) continue;
      const content = fs.readFileSync(path.resolve(srcDir, f), 'utf8');
      expect(content).not.toContain('@ts-ignore');
    }
  });
});
