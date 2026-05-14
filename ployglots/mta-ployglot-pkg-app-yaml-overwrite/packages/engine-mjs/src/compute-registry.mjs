import { ComputeScope } from './options.mjs';
import { ComputeFunctionError, ErrorCode } from './errors.mjs';

const NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class ComputeRegistry {
  #fns = new Map();
  #cache = new Map();

  validateName(name) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
      throw new Error(`Invalid function name: ${name}`);
    }
  }

  register(name, fn, scope = ComputeScope.REQUEST) {
    this.validateName(name);
    if (typeof fn !== 'function') {
      throw new Error(`Compute function must be a function: ${name}`);
    }
    this.#fns.set(name, { fn, scope });
  }

  unregister(name) {
    for (const key of [...this.#cache.keys()]) {
      if (key.startsWith(`${name}:`)) this.#cache.delete(key);
    }
    return this.#fns.delete(name);
  }

  has(name) {
    return this.#fns.has(name);
  }

  list() {
    return [...this.#fns.keys()];
  }

  getScope(name) {
    return this.#fns.get(name)?.scope;
  }

  clear() {
    this.#fns.clear();
    this.#cache.clear();
  }

  clearCache() {
    this.#cache.clear();
  }

  async resolve(name, context, propertyPath) {
    const reg = this.#fns.get(name);
    if (!reg) {
      throw new ComputeFunctionError(
        `Compute function not found: ${name}`,
        ErrorCode.COMPUTE_FUNCTION_NOT_FOUND,
        { name },
      );
    }
    const cacheKey = `${name}:${propertyPath ?? ''}`;
    if (reg.scope === ComputeScope.STARTUP && this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }
    let result;
    try {
      result = await Promise.resolve(reg.fn(context, propertyPath));
    } catch (e) {
      throw new ComputeFunctionError(
        `Compute function failed: ${name}`,
        ErrorCode.COMPUTE_FUNCTION_FAILED,
        { name, originalError: e?.message ?? String(e) },
      );
    }
    if (reg.scope === ComputeScope.STARTUP) {
      this.#cache.set(cacheKey, result);
    }
    return result;
  }
}
