import { AppYamlConfig } from './core.mjs';

export class AppYamlConfigSDK {
  #config;

  constructor(config) {
    this.#config = config;
  }

  static async fromDirectory(configDir) {
    await AppYamlConfig.initialize({ configDir });
    return new AppYamlConfigSDK(AppYamlConfig.getInstance());
  }

  getAll() {
    return this.#config.getAll();
  }

  listProviders() {
    return Object.keys(this.#config.get('providers') ?? {});
  }

  listServices() {
    return Object.keys(this.#config.get('services') ?? {});
  }

  listStorages() {
    return Object.keys(this.#config.get('storage') ?? {});
  }

  get(path, defaultValue) {
    if (!path || typeof path !== 'string') return defaultValue;
    const parts = path.split('.');
    let cur = this.#config.getAll();
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p];
      } else {
        return defaultValue;
      }
    }
    return cur ?? defaultValue;
  }
}
