// @ts-nocheck
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from '../src/index.ts';

function withEnv(map: Record<string, string>, fn: () => void): void {
  const snap = new Map<string, string | undefined>();
  for (const k of Object.keys(map)) {
    snap.set(k, process.env[k]);
    process.env[k] = map[k]!;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of snap) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('arg-tier returns arg directly', () => {
  assert.strictEqual(resolve('hi', 'X', { x: 'cfg' }, 'x', 'DEFAULT'), 'hi');
});

test('env-tier first-match from list', () => {
  withEnv({ DB_URL: 'postgres://primary' }, () => {
    assert.strictEqual(
      resolve(null, ['MISSING_A', 'DB_URL', 'MISSING_B'], null, null, 'DEFAULT'),
      'postgres://primary',
    );
  });
});

test('env-tier string form', () => {
  withEnv({ REGION: 'us-west-2' }, () => {
    assert.strictEqual(resolve(null, 'REGION', null, null, 'DEFAULT'), 'us-west-2');
  });
});

test('config-tier returns zero value', () => {
  assert.strictEqual(resolve(null, null, { port: 0 }, 'port', 80), 0);
});

test('config-tier skips explicit null (D3)', () => {
  assert.strictEqual(resolve(null, null, { x: null }, 'x', 'DEFAULT'), 'DEFAULT');
});

test('config-tier skips explicit undefined (D3)', () => {
  assert.strictEqual(resolve(null, null, { x: undefined }, 'x', 'DEFAULT'), 'DEFAULT');
});

test('default fallthrough', () => {
  assert.strictEqual(resolve(null, null, null, null, 'DEFAULT'), 'DEFAULT');
});

test('empty-string env-key skipped', () => {
  withEnv({ REAL_KEY: 'found' }, () => {
    assert.strictEqual(resolve(null, ['', 'REAL_KEY'], null, null, 'DEFAULT'), 'found');
  });
});

test('envKeys=null short-circuits (D7)', () => {
  assert.strictEqual(resolve(null, null, { k: 'from-cfg' }, 'k', 'DEFAULT'), 'from-cfg');
});

test('envKeys=undefined short-circuits (D7)', () => {
  assert.strictEqual(resolve(null, undefined, { k: 'from-cfg' }, 'k', 'DEFAULT'), 'from-cfg');
});

test('arg=undefined treated as unset (D1)', () => {
  assert.strictEqual(resolve(undefined, null, null, null, 'DEFAULT'), 'DEFAULT');
});
