export const ErrorCode = Object.freeze({
  COMPUTE_FUNCTION_NOT_FOUND: 'COMPUTE_FUNCTION_NOT_FOUND',
  COMPUTE_FUNCTION_FAILED: 'COMPUTE_FUNCTION_FAILED',
  RECURSION_LIMIT: 'RECURSION_LIMIT',
  SECURITY: 'SECURITY',
  SCOPE_VIOLATION: 'SCOPE_VIOLATION',
});

export class ComputeFunctionError extends Error {
  constructor(message, code, ctx = {}) {
    super(message);
    this.name = 'ComputeFunctionError';
    this.code = code;
    this.ctx = ctx;
  }
}

export class RecursionLimitError extends Error {
  constructor(message, ctx = {}) {
    super(message);
    this.name = 'RecursionLimitError';
    this.code = ErrorCode.RECURSION_LIMIT;
    this.ctx = ctx;
  }
}

export class SecurityError extends Error {
  constructor(message, ctx = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = ErrorCode.SECURITY;
    this.ctx = ctx;
  }
}

export class ScopeViolationError extends Error {
  constructor(message, ctx = {}) {
    super(message);
    this.name = 'ScopeViolationError';
    this.code = ErrorCode.SCOPE_VIOLATION;
    this.ctx = ctx;
  }
}
