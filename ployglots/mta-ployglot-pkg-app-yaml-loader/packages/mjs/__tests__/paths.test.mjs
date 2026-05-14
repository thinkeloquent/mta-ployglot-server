import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfigDir, resolveAppEnv } from '../src/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'parity', 'paths.json'), 'utf8'),
);

function withEnv(envOverrides, fn) {
  const keys = ['CONFIG_DIR', 'APP_ENV'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(envOverrides)) process.env[k] = v;
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

for (const tc of fixture.resolveConfigDir) {
  test(`resolveConfigDir: ${tc.name}`, () => {
    withEnv(tc.env, () => {
      if (tc.expectedError) {
        assert.throws(
          () => resolveConfigDir(tc.override === null ? undefined : tc.override, tc.callerDir ?? undefined),
          new RegExp(tc.expectedError),
        );
      } else {
        const got = resolveConfigDir(
          tc.override === null ? undefined : tc.override,
          tc.callerDir ?? undefined,
        );
        assert.equal(got, tc.expected);
      }
    });
  });
}

for (const tc of fixture.resolveAppEnv) {
  test(`resolveAppEnv: ${tc.name}`, () => {
    withEnv(tc.env, () => {
      const got = resolveAppEnv(tc.override === null ? undefined : tc.override);
      assert.equal(got, tc.expected);
    });
  });
}
