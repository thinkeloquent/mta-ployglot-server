import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GitHubError,
  GitHubAuthError,
  GitHubGraphQLError,
  GitHubHTTPError,
  RateLimitError,
  ConfigurationError,
  ValidationError,
  BuiltInFieldError,
  FieldNotWritableError,
  FieldOptionNotFoundError,
  NotADraftError,
  ViewOperationUnsupportedError,
  AttachmentUploadUnavailableError,
} from '../../src/client/errors.mjs';

test('all classes extend GitHubError', () => {
  for (const C of [GitHubAuthError, GitHubGraphQLError, GitHubHTTPError, ConfigurationError, ValidationError]) {
    const inst = new C('m', { errors: [], status: 1 });
    assert.ok(inst instanceof GitHubError, `${C.name} should extend GitHubError`);
  }
  for (const C of [BuiltInFieldError, FieldNotWritableError, FieldOptionNotFoundError, NotADraftError, ViewOperationUnsupportedError, AttachmentUploadUnavailableError]) {
    assert.ok(new C('m') instanceof GitHubError);
  }
});

test('ViewOperationUnsupportedError carries code', () => {
  assert.equal(new ViewOperationUnsupportedError('m').code, 'VIEW_MUTATION_UNAVAILABLE');
});

test('RateLimitError parses x-ratelimit-reset', () => {
  const err = new RateLimitError({ status: 403, headers: { 'x-ratelimit-reset': '1700000000' } }, 'primary');
  assert.ok(err.resetAt instanceof Date);
  assert.equal(err.kind, 'primary');
});

test('GitHubHTTPError carries body', () => {
  const err = new GitHubHTTPError({ status: 500, body: { x: 1 } });
  assert.equal(err.status, 500);
  assert.deepEqual(err.responseBody, { x: 1 });
});
