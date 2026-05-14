import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mergeGlobalIntoProviders } from '../src/merge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, '../../../parity/globalize.json');
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));

for (const row of fixtures) {
  test(`mergeGlobalIntoProviders: ${row.name}`, () => {
    assert.deepEqual(mergeGlobalIntoProviders(row.input), row.expected);
  });
}

test('mergeGlobalIntoProviders: provider keys win on conflict', () => {
  const input = {
    global: { timeout: 5000, region: 'us' },
    providers: { p: { timeout: 1000 } },
  };
  const out = mergeGlobalIntoProviders(input);
  assert.equal(out.providers.p.timeout, 1000);
  assert.equal(out.providers.p.region, 'us');
});

test('mergeGlobalIntoProviders: does not mutate input', () => {
  const input = { global: { x: 1 }, providers: { p: {} } };
  const out = mergeGlobalIntoProviders(input);
  out.providers.p.x = 999;
  assert.equal(input.providers.p.x, undefined);
});
