// @ts-nocheck
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as joinPath } from 'node:path';
import { resolve, resolveBool, resolveInt, resolveFloat } from '../src/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = joinPath(__dirname, '..', '..', '..', 'tests', 'parity', 'fixtures.json');

interface FixtureCase {
  id: string;
  function: 'resolve' | 'resolve_bool' | 'resolve_int' | 'resolve_float';
  inputs: {
    arg: unknown;
    env_keys: string | string[] | null;
    env: Record<string, string>;
    config: Record<string, unknown> | null;
    config_key: string | null;
    default: unknown;
  };
  expected: unknown;
  notes?: string;
}

const dispatch = {
  resolve,
  resolve_bool: resolveBool,
  resolve_int: resolveInt,
  resolve_float: resolveFloat,
};

const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8')) as {
  version: number;
  cases: FixtureCase[];
};

for (const c of fixtures.cases) {
  test(`parity:${c.id}:${c.function}`, () => {
    const snapshot = new Map<string, string | undefined>();
    for (const k of Object.keys(c.inputs.env)) {
      snapshot.set(k, process.env[k]);
      process.env[k] = c.inputs.env[k]!;
    }
    try {
      const fn = dispatch[c.function] as (...args: unknown[]) => unknown;
      const result = fn(
        c.inputs.arg,
        c.inputs.env_keys,
        c.inputs.config,
        c.inputs.config_key,
        c.inputs.default,
      );
      assert.deepStrictEqual(
        result,
        c.expected,
        `case ${c.id}: got ${JSON.stringify(result)}, expected ${JSON.stringify(c.expected)}`,
      );
    } finally {
      for (const [k, v] of snapshot) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
}

test('env snapshot: missing key restoration', () => {
  delete process.env.PARITY_NEW;
  const before = process.env.PARITY_NEW;
  const snapshot = new Map<string, string | undefined>();
  snapshot.set('PARITY_NEW', process.env.PARITY_NEW);
  process.env.PARITY_NEW = 'transient';
  for (const [k, v] of snapshot) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  assert.strictEqual(process.env.PARITY_NEW, before);
  assert.strictEqual(process.env.PARITY_NEW, undefined);
});

test('env snapshot: empty-string key round-trip', () => {
  process.env.PARITY_EMPTY = '';
  const snapshot = new Map<string, string | undefined>();
  snapshot.set('PARITY_EMPTY', process.env.PARITY_EMPTY);
  process.env.PARITY_EMPTY = 'something';
  for (const [k, v] of snapshot) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  assert.strictEqual(process.env.PARITY_EMPTY, '');
  delete process.env.PARITY_EMPTY;
});
