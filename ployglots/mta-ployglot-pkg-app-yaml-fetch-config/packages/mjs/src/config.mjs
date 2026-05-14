import * as fs from 'node:fs';
import yaml from 'js-yaml';

import { ConfigError } from './errors.mjs';
import { createEndpointConfig, createFetchConfig } from './models.mjs';

let _config = null;

export function loadConfig(config) {
  _config = config;
  return _config;
}

export function loadConfigFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('[app-yaml-fetch-config] Config file not found:', filePath);
    _config = { endpoints: {}, intent_mapping: {} };
    return _config;
  }
  try {
    _config = yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
    return _config;
  } catch (err) {
    throw new ConfigError(`Failed to parse YAML: ${err.message}`);
  }
}

export function getConfig() {
  if (_config === null) throw new ConfigError('Configuration not loaded.');
  return _config;
}

export function listEndpoints() {
  return Object.keys(getConfig().endpoints || {});
}

export function getEndpoint(serviceId) {
  const cleanId = serviceId.replace('endpoints.', '');
  const endpoints = getConfig().endpoints || {};
  const raw = endpoints[cleanId];
  if (!raw) return null;
  return createEndpointConfig(raw, cleanId);
}

export function resolveIntent(intent) {
  const mapping = getConfig().intent_mapping || {};
  const mappings = mapping.mappings || {};
  const def = mapping.default_intent || 'llm001';
  return mappings[intent] || def;
}

function composeHeaders(endpoint, customHeaders) {
  const headers = { 'Content-Type': 'application/json' };
  Object.assign(headers, endpoint.headers);
  if (customHeaders) Object.assign(headers, customHeaders);
  return headers;
}

function composeBody(endpoint, payload) {
  return endpoint.bodyType === 'text' ? String(payload) : JSON.stringify(payload);
}

export function getFetchConfig(serviceId, payload, customHeaders = null) {
  const cleanId = serviceId.replace('endpoints.', '');
  const endpoint = getEndpoint(cleanId);
  if (!endpoint) {
    const available = listEndpoints();
    throw new ConfigError(`Service '${cleanId}' not found`, cleanId, available);
  }
  return createFetchConfig({
    serviceId: cleanId,
    url: endpoint.baseUrl,
    method: endpoint.method,
    headers: composeHeaders(endpoint, customHeaders),
    body: composeBody(endpoint, payload),
    timeout: endpoint.timeout,
  });
}
