import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  loadConfig,
  loadConfigFromFile,
  getConfig,
  listEndpoints,
  ConfigError,
} from '../src/index.mjs';

test('loadConfig: stores object and returns identity', () => {
  const obj = { endpoints: { a: { baseUrl: 'x' } } };
  const ret = loadConfig(obj);
  assert.equal(ret, obj);
  assert.equal(getConfig(), obj);
});

test('loadConfig({}) resets to empty', () => {
  loadConfig({});
  assert.deepEqual(getConfig(), {});
  assert.deepEqual(listEndpoints(), []);
});

test('listEndpoints: returns endpoint keys', () => {
  loadConfig({ endpoints: { a: {}, b: {}, c: {} } });
  assert.deepEqual(listEndpoints().sort(), ['a', 'b', 'c']);
});

test('loadConfigFromFile: reads + parses real YAML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afc-'));
  const file = path.join(dir, 'endpoints.yaml');
  fs.writeFileSync(
    file,
    'endpoints:\n  llm001:\n    baseUrl: https://x\n    method: POST\nintent_mapping:\n  default_intent: llm001\n',
  );
  const cfg = loadConfigFromFile(file);
  assert.equal(cfg.endpoints.llm001.baseUrl, 'https://x');
  assert.equal(cfg.intent_mapping.default_intent, 'llm001');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadConfigFromFile: missing file warns + stores empty defaults', () => {
  const cfg = loadConfigFromFile('/nonexistent/path/that/does/not/exist.yaml');
  assert.deepEqual(cfg, { endpoints: {}, intent_mapping: {} });
});

test('loadConfigFromFile: invalid YAML throws ConfigError', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afc-'));
  const file = path.join(dir, 'bad.yaml');
  fs.writeFileSync(file, 'endpoints:\n  llm001: { baseUrl: : :\n');
  assert.throws(() => loadConfigFromFile(file), ConfigError);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('getConfig before any load throws ConfigError', async () => {
  // Spawn a fresh subprocess to verify the cold-start path — module-level
  // `_config` is process-wide and earlier tests have already populated it.
  const { spawnSync } = await import('node:child_process');
  const code = "import('./src/index.mjs').then(m => { try { m.getConfig(); console.log('NO_THROW'); } catch (e) { console.log(e.name); } });";
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: path.resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  assert.equal(res.stdout.trim(), 'ConfigError');
});
