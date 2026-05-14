import _get from 'lodash/get.js';
import { resolve as envResolve } from '@org/env-resolve';

import { ComputeRegistry } from './compute-registry.mjs';
import {
  ComputeFunctionError,
  ErrorCode,
  RecursionLimitError,
  ScopeViolationError,
} from './errors.mjs';
import { ComputeScope, MissingStrategy } from './options.mjs';
import { Security } from './security.mjs';

export const ENV_PATTERN = /^\{\{env\.([A-Z_][A-Z0-9_]*)(\s*\|\s*['"](.*)['"])?\}\}$/;
// `fn:NAME` or `fn:NAME.dotted.accessor` — accessor is sliced off the result.
export const COMPUTE_PATTERN =
  /^\{\{fn:([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_-]*)*)(\s*\|\s*['"](.*)['"])?\}\}$/;
// Path segments may contain dashes (e.g. `request.headers.x-request-id`).
export const TEMPLATE_PATTERN = /^\{\{([a-zA-Z0-9_.\-]*)(\s*\|\s*['"](.*)['"])?\}\}$/;

export function parseDefault(val) {
  if (val === undefined || val === null) return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val !== '' && !Number.isNaN(Number(val))) return Number(val);
  return val;
}

export class ContextResolver {
  constructor(options = {}) {
    this.registry = options.registry ?? new ComputeRegistry();
    this.missingStrategy = options.missingStrategy ?? MissingStrategy.ERROR;
    this.maxDepth = options.maxDepth ?? 10;
    this._namespaces = new Map();
  }

  getRegistry() {
    return this.registry;
  }

  registerNamespace(prefix, handler) {
    if (typeof prefix !== 'string' || !prefix) {
      throw new Error('Namespace prefix must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('Namespace handler must be a function');
    }
    this._namespaces.set(prefix, handler);
  }

  unregisterNamespace(prefix) {
    return this._namespaces.delete(prefix);
  }

  async resolve(expression, context, scope = ComputeScope.REQUEST, depth = 0) {
    if (typeof expression !== 'string') return expression;
    if (depth > this.maxDepth) {
      throw new RecursionLimitError(
        `Recursion limit exceeded (maxDepth=${this.maxDepth})`,
        { expression, depth },
      );
    }

    const env = ENV_PATTERN.exec(expression);
    if (env) return this._resolveEnv(env, expression);

    const fn = COMPUTE_PATTERN.exec(expression);
    if (fn) return this._resolveCompute(fn, context, scope, expression);

    const tpl = TEMPLATE_PATTERN.exec(expression);
    if (tpl) return this._resolveTemplate(tpl, context, expression);

    return expression;
  }

  async resolveObject(obj, context, scope = ComputeScope.REQUEST, depth = 0) {
    if (depth > this.maxDepth) {
      throw new RecursionLimitError(
        `Recursion limit exceeded (maxDepth=${this.maxDepth})`,
        { depth },
      );
    }
    if (Array.isArray(obj)) {
      const out = [];
      for (const v of obj) {
        out.push(await this.resolveObject(v, context, scope, depth + 1));
      }
      return out;
    }
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        out[k] = await this.resolveObject(obj[k], context, scope, depth + 1);
      }
      return out;
    }
    if (typeof obj === 'string') return this.resolve(obj, context, scope, depth);
    return obj;
  }

  async _resolveEnv(match, expression) {
    const varName = match[1];
    const defaultRaw = match[3];
    const defaultVal = defaultRaw !== undefined ? parseDefault(defaultRaw) : undefined;

    const override = this._namespaces.get('env');
    if (override) {
      return override(varName, defaultVal);
    }
    const value = envResolve(undefined, [varName], undefined, undefined, defaultVal);
    if (value === undefined && defaultRaw === undefined) {
      return this._handleMissing(expression, `Env variable not found: ${varName}`);
    }
    return value;
  }

  async _resolveCompute(match, context, scope, expression) {
    const fullName = match[1];
    const defaultRaw = match[3];
    // `fn:NAME.path.to.value` — split the registry name from an optional
    // dotted accessor applied after the function returns.
    const dot = fullName.indexOf('.');
    const fnName = dot === -1 ? fullName : fullName.slice(0, dot);
    const accessor = dot === -1 ? undefined : fullName.slice(dot + 1);
    if (!this.registry.has(fnName)) {
      return this._handleMissing(expression, `Compute function not registered: ${fnName}`, defaultRaw);
    }
    const fnScope = this.registry.getScope(fnName);
    if (scope === ComputeScope.STARTUP && fnScope === ComputeScope.REQUEST) {
      // REQUEST functions during STARTUP scope return the literal template string.
      return expression;
    }
    const result = await this.registry.resolve(fnName, context, accessor);
    if (accessor !== undefined && result && typeof result === 'object') {
      const sliced = _get(result, accessor);
      if (sliced === undefined) {
        return this._handleMissing(
          expression,
          `Path not found in compute result: ${fullName}`,
          defaultRaw,
        );
      }
      return sliced;
    }
    return result;
  }

  async _resolveTemplate(match, context, expression) {
    const path = match[1];
    const defaultRaw = match[3];
    Security.validatePath(path);
    const value = _get(context, path);
    if (value === undefined) {
      return this._handleMissing(expression, `Path not found in context: ${path}`, defaultRaw);
    }
    return value;
  }

  _handleMissing(expression, message, defaultRaw) {
    if (defaultRaw !== undefined) return parseDefault(defaultRaw);
    if (this.missingStrategy === MissingStrategy.IGNORE) return expression;
    if (this.missingStrategy === MissingStrategy.DEFAULT) return undefined;
    throw new ComputeFunctionError(message, ErrorCode.COMPUTE_FUNCTION_NOT_FOUND, { expression });
  }
}

export function createResolver(options) {
  return new ContextResolver(options);
}

// Suppress unused import warning — exported for completeness.
export { ScopeViolationError };
