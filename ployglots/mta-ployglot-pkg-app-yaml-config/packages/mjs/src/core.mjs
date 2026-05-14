import { mergeFiles, mergeGlobalIntoProviders } from './merge.mjs';
import { ImmutabilityError } from './errors.mjs';

const IMMUTABLE_MSG = 'Configuration is immutable';

export class AppYamlConfig {
  static _instance = null;

  _config = {};
  _originalConfigs = new Map();
  _initialMergedConfig = null;
  _logger;

  constructor(logger) {
    this._logger = logger;
  }

  static async initialize(options = {}) {
    if (AppYamlConfig._instance) return AppYamlConfig._instance;

    let opts = options;
    if (!opts.loaded) {
      let loader;
      try {
        loader = await import('app-yaml-loader');
      } catch {
        throw new Error(
          'AppYamlConfig.initialize requires either `loaded` (Map<path, parsed>) or the optional dependency `app-yaml-loader`'
        );
      }
      if (opts.files) {
        opts = { ...opts, loaded: await loader.loadFiles(opts.files) };
      } else if (opts.configDir) {
        opts = { ...opts, loaded: await loader.loadFromConfigDir(opts) };
      } else {
        throw new Error(
          'AppYamlConfig.initialize needs one of: loaded, files, configDir'
        );
      }
    }

    const inst = new AppYamlConfig(opts.logger);
    for (const [path, parsed] of opts.loaded.entries()) {
      inst._originalConfigs.set(path, structuredClone(parsed ?? {}));
    }

    let merged = mergeFiles(opts.loaded);
    merged = mergeGlobalIntoProviders(merged);
    inst._config = merged;
    inst._initialMergedConfig = structuredClone(merged);

    AppYamlConfig._instance = inst;
    return inst;
  }

  static getInstance() {
    if (!AppYamlConfig._instance) {
      throw new Error('AppYamlConfig not initialized');
    }
    return AppYamlConfig._instance;
  }

  static _resetForTesting() {
    AppYamlConfig._instance = null;
  }

  restore() {
    if (this._initialMergedConfig) {
      this._config = structuredClone(this._initialMergedConfig);
    }
  }

  get(key, defaultValue) {
    const v = key in this._config ? this._config[key] : defaultValue;
    return v && typeof v === 'object' ? structuredClone(v) : v;
  }

  getNested(keys, defaultValue) {
    let cur = this._config;
    for (const k of keys) {
      if (cur && typeof cur === 'object' && k in cur) {
        cur = cur[k];
      } else {
        return defaultValue;
      }
    }
    return cur && typeof cur === 'object' ? structuredClone(cur) : cur;
  }

  getAll() {
    return structuredClone(this._config);
  }

  getGlobalAppConfig() {
    return structuredClone(this._config.global ?? {});
  }

  getOriginal(file) {
    if (!file) return undefined;
    const v = this._originalConfigs.get(file);
    return v ? structuredClone(v) : undefined;
  }

  getOriginalAll() {
    const out = new Map();
    for (const [k, v] of this._originalConfigs.entries()) {
      out.set(k, structuredClone(v));
    }
    return out;
  }

  // eslint-disable-next-line no-unused-vars
  set(_k, _v) { throw new ImmutabilityError(IMMUTABLE_MSG); }
  // eslint-disable-next-line no-unused-vars
  update(_u) { throw new ImmutabilityError(IMMUTABLE_MSG); }
  reset() { throw new ImmutabilityError(IMMUTABLE_MSG); }
  clear() { throw new ImmutabilityError(IMMUTABLE_MSG); }
}
