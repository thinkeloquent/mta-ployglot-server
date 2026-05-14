import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadConfig, getEndpoint, resolveIntent } from '../src/index.mjs';

const FIXTURE = {
  endpoints: {
    llm001: { baseUrl: 'https://api.example.com/v1/chat', method: 'POST', tags: ['llm'] },
    llm002: { baseUrl: 'https://api.alt.com/v1/chat', method: 'POST', tags: ['llm'] },
  },
  intent_mapping: {
    default_intent: 'llm001',
    mappings: { storybook: 'llm002', summary: 'llm001' },
  },
};

test('getEndpoint: known id returns built EndpointConfig', () => {
  loadConfig(FIXTURE);
  const ep = getEndpoint('llm001');
  assert.equal(ep.key, 'llm001');
  assert.equal(ep.baseUrl, 'https://api.example.com/v1/chat');
  assert.equal(ep.method, 'POST');
});

test('getEndpoint: dotted prefix accepted (FC2)', () => {
  loadConfig(FIXTURE);
  const ep = getEndpoint('endpoints.llm001');
  assert.equal(ep.key, 'llm001');
  assert.equal(ep.baseUrl, 'https://api.example.com/v1/chat');
});

test('getEndpoint: unknown id returns null', () => {
  loadConfig(FIXTURE);
  assert.equal(getEndpoint('nope'), null);
});

test('resolveIntent: mapped intent returns mapped service id', () => {
  loadConfig(FIXTURE);
  assert.equal(resolveIntent('storybook'), 'llm002');
  assert.equal(resolveIntent('summary'), 'llm001');
});

test('resolveIntent: unmapped intent returns default_intent', () => {
  loadConfig(FIXTURE);
  assert.equal(resolveIntent('unknown'), 'llm001');
});

test('resolveIntent: no default_intent → llm001 literal', () => {
  loadConfig({ endpoints: {}, intent_mapping: { mappings: {} } });
  assert.equal(resolveIntent('unknown'), 'llm001');
});
