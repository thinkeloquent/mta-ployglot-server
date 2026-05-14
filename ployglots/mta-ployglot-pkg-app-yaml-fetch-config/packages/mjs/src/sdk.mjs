import {
  loadConfig as moduleLoadConfig,
  loadConfigFromFile,
  getConfig,
  listEndpoints,
  getEndpoint,
  resolveIntent as moduleResolveIntent,
  getFetchConfig as moduleGetFetchConfig,
} from './config.mjs';

export class EndpointConfigSDK {
  #filePath;

  constructor({ filePath = null } = {}) {
    this.#filePath = filePath;
  }

  loadConfig(obj) {
    return moduleLoadConfig(obj);
  }

  loadFromFile(filePath) {
    this.#filePath = filePath;
    return loadConfigFromFile(filePath);
  }

  refreshConfig() {
    if (!this.#filePath) {
      throw new Error('Cannot refresh: no filePath. Use loadFromFile() first.');
    }
    return loadConfigFromFile(this.#filePath);
  }

  getByKey(key) {
    return getEndpoint(key);
  }

  getAll() {
    return listEndpoints()
      .map((k) => getEndpoint(k))
      .filter(Boolean);
  }

  getByName(name) {
    return this.getAll().find((ep) => ep.name === name) || null;
  }

  getByTag(tag) {
    return this.getAll().filter((ep) => ep.tags.includes(tag));
  }

  listKeys() {
    return listEndpoints();
  }

  properties(dotPath, defaultValue) {
    const cfg = getConfig();
    const parts = dotPath.split('.');
    let cur = cfg;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return defaultValue;
      cur = cur[p];
    }
    return cur !== undefined ? cur : defaultValue;
  }

  resolveIntent(intent) {
    const key = moduleResolveIntent(intent);
    return { key, endpoint: getEndpoint(key) };
  }

  getFetchConfig(serviceId, payload, customHeaders = null) {
    return moduleGetFetchConfig(serviceId, payload, customHeaders);
  }
}

export function createEndpointConfigSDK(options = {}) {
  return new EndpointConfigSDK(options);
}
