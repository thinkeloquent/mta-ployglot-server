import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfigFiles } from '../src/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'parity', 'build-config-files.json'),
    'utf8',
  ),
);

for (const tc of cases) {
  test(`buildConfigFiles: ${tc.name}`, () => {
    const got = buildConfigFiles(tc.configDir, tc.appEnv, tc.baseFiles, tc.envSuffixes);
    assert.deepEqual(got, tc.expected);
  });
}
