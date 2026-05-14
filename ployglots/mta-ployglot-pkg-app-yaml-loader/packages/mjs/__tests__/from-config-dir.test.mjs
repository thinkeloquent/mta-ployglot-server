import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFromConfigDir } from '../src/loader.mjs';
import { clearCache } from '../src/cache.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANONICAL = path.resolve(
  __dirname, '..', '..', '..', 'parity', 'fixtures', 'canonical-config',
);

beforeEach(() => clearCache());

test('loadFromConfigDir returns 6 keys in canonical order', async () => {
  const map = await loadFromConfigDir({ configDir: CANONICAL, appEnv: 'test' });
  const keys = Array.from(map.keys()).map((p) => path.basename(p));
  assert.deepEqual(keys, [
    'base.yml',
    'security.yml',
    'api-release-date.yml',
    'feature_flags.yml',
    'server.test.yaml',
    'endpoint.test.yaml',
  ]);
  assert.equal(map.get(path.join(CANONICAL, 'base.yml')).global.layer, 'base');
});

test('baseFiles=[] returns only env-suffixed entries', async () => {
  const map = await loadFromConfigDir({
    configDir: CANONICAL,
    appEnv: 'test',
    baseFiles: [],
  });
  const keys = Array.from(map.keys()).map((p) => path.basename(p));
  assert.deepEqual(keys, ['server.test.yaml', 'endpoint.test.yaml']);
});
