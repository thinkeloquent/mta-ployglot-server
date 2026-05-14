export class GitHubError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'GitHubError';
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

export class GitHubAuthError extends GitHubError {
  constructor(res) {
    super('GitHub authentication failed (401)', { status: 401 });
    this.name = 'GitHubAuthError';
    this.responseBody = res?.body;
  }
}

export class GitHubGraphQLError extends GitHubError {
  constructor(message, { errors, status } = {}) {
    super(message, { status });
    this.name = 'GitHubGraphQLError';
    this.errors = errors ?? [];
  }
}

export class GitHubHTTPError extends GitHubError {
  constructor(res) {
    super(`GitHub HTTP ${res.status}`, { status: res.status });
    this.name = 'GitHubHTTPError';
    this.responseBody = res.body;
  }
}

export class RateLimitError extends GitHubError {
  constructor(res, kind) {
    super(`GitHub rate limit (${kind})`, { status: res.status });
    this.name = 'RateLimitError';
    this.kind = kind;
    this.resetAt = res.headers?.['x-ratelimit-reset']
      ? new Date(Number(res.headers['x-ratelimit-reset']) * 1000)
      : null;
  }
}

export class ConfigurationError extends GitHubError {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends GitHubError {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const namedError = (name, code) => class extends GitHubError {
  constructor(message, extra = {}) {
    super(message);
    this.name = name;
    this.code = code;
    Object.assign(this, extra);
  }
};

export const BuiltInFieldError = namedError('BuiltInFieldError', 'BUILT_IN_FIELD');
export const FieldNotWritableError = namedError('FieldNotWritableError', 'FIELD_NOT_WRITABLE');
export const FieldOptionNotFoundError = namedError('FieldOptionNotFoundError', 'FIELD_OPTION_NOT_FOUND');
export const NotADraftError = namedError('NotADraftError', 'NOT_A_DRAFT');
export const ViewOperationUnsupportedError = namedError('ViewOperationUnsupportedError', 'VIEW_MUTATION_UNAVAILABLE');
export const AttachmentUploadUnavailableError = namedError('AttachmentUploadUnavailableError', 'ATTACHMENT_UPLOAD_UNAVAILABLE');
