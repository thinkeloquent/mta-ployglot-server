export const VERSION = '0.1.0';

export { ComputeScope, MissingStrategy } from './options.mjs';
export {
  ErrorCode,
  ComputeFunctionError,
  RecursionLimitError,
  SecurityError,
  ScopeViolationError,
} from './errors.mjs';
export { ComputeRegistry } from './compute-registry.mjs';
export { Security } from './security.mjs';
export {
  ContextResolver,
  createResolver,
  parseDefault,
  ENV_PATTERN,
  COMPUTE_PATTERN,
  TEMPLATE_PATTERN,
} from './context-resolver.mjs';
