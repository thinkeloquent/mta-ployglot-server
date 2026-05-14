import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ContextResolver,
  ENV_PATTERN,
  COMPUTE_PATTERN,
  TEMPLATE_PATTERN,
  parseDefault,
  createResolver,
} from '../src/context-resolver.mjs';
import { ComputeScope, MissingStrategy } from '../src/options.mjs';
import { ComputeFunctionError, RecursionLimitError, SecurityError } from '../src/errors.mjs';

test('ENV_PATTERN matches {{env.VAR}}', () => {
  assert.equal(ENV_PATTERN.test('{{env.HOME}}'), true);
  assert.equal(ENV_PATTERN.test('{{env.MY_VAR | "fb"}}'), true);
  assert.equal(ENV_PATTERN.test('{{env.bad}}'), false); // requires uppercase
});

test('COMPUTE_PATTERN matches {{fn:NAME}}', () => {
  assert.equal(COMPUTE_PATTERN.test('{{fn:now}}'), true);
  assert.equal(COMPUTE_PATTERN.test('{{fn:_x | "default"}}'), true);
  assert.equal(COMPUTE_PATTERN.test('{{fn:1bad}}'), false);
});

test('COMPUTE_PATTERN matches {{fn:NAME.dotted.accessor}}', () => {
  assert.equal(COMPUTE_PATTERN.test('{{fn:startup_tokens.case_001}}'), true);
  assert.equal(COMPUTE_PATTERN.test('{{fn:provider_api_keys.gemini_openai}}'), true);
  assert.equal(COMPUTE_PATTERN.test('{{fn:a.b.c | "fallback"}}'), true);
});

test('TEMPLATE_PATTERN matches {{path.to.value}}', () => {
  assert.equal(TEMPLATE_PATTERN.test('{{a.b.c}}'), true);
  // ENV must be tried first since TEMPLATE matches env.* too:
  assert.equal(TEMPLATE_PATTERN.test('{{env.X}}'), true);
});

test('TEMPLATE_PATTERN matches dashed path segments', () => {
  // Dashes in path segments (e.g. HTTP header names like x-request-id).
  assert.equal(TEMPLATE_PATTERN.test('{{request.headers.x-request-id}}'), true);
  assert.equal(TEMPLATE_PATTERN.test('{{a.b-c.d}}'), true);
});

test('parseDefault coerces booleans, numbers, leaves strings', () => {
  assert.equal(parseDefault('true'), true);
  assert.equal(parseDefault('false'), false);
  assert.equal(parseDefault('42'), 42);
  assert.equal(parseDefault('3.14'), 3.14);
  assert.equal(parseDefault('hello'), 'hello');
  assert.equal(parseDefault(''), '');
});

test('resolve: path lookup', async () => {
  const r = new ContextResolver();
  assert.equal(await r.resolve('{{a.b}}', { a: { b: 7 } }), 7);
  assert.equal(await r.resolve('{{a.deeply.nested.x}}', { a: { deeply: { nested: { x: 'ok' } } } }), 'ok');
});

test('resolve: literal pass-through', async () => {
  const r = new ContextResolver();
  assert.equal(await r.resolve('plain string', {}), 'plain string');
});

test('resolve: non-string passes through', async () => {
  const r = new ContextResolver();
  assert.equal(await r.resolve(42, {}), 42);
  assert.equal(await r.resolve(null, {}), null);
});

test('resolveObject: tree walker', async () => {
  const r = new ContextResolver();
  const result = await r.resolveObject(
    { a: '{{x}}', b: [{ c: '{{y}}' }], n: 99 },
    { x: 1, y: 2 },
  );
  assert.deepEqual(result, { a: 1, b: [{ c: 2 }], n: 99 });
});

test('missingStrategy ERROR raises', async () => {
  const r = new ContextResolver({ missingStrategy: MissingStrategy.ERROR });
  await assert.rejects(() => r.resolve('{{nope}}', {}), ComputeFunctionError);
});

test('missingStrategy IGNORE returns the literal', async () => {
  const r = new ContextResolver({ missingStrategy: MissingStrategy.IGNORE });
  assert.equal(await r.resolve('{{nope}}', {}), '{{nope}}');
});

test('missingStrategy DEFAULT returns undefined', async () => {
  const r = new ContextResolver({ missingStrategy: MissingStrategy.DEFAULT });
  assert.equal(await r.resolve('{{nope}}', {}), undefined);
});

test('inline default takes precedence over missingStrategy', async () => {
  const r = new ContextResolver({ missingStrategy: MissingStrategy.ERROR });
  assert.equal(await r.resolve('{{nope | "fb"}}', {}), 'fb');
  assert.equal(await r.resolve('{{nope | "42"}}', {}), 42);
  assert.equal(await r.resolve('{{nope | "true"}}', {}), true);
});

test('compute function dispatch via {{fn:NAME}}', async () => {
  const r = new ContextResolver();
  r.getRegistry().register('greet', () => 'hello', ComputeScope.REQUEST);
  assert.equal(await r.resolve('{{fn:greet}}', {}), 'hello');
});

test('compute function dotted accessor slices dict result', async () => {
  const r = new ContextResolver();
  r.getRegistry().register(
    'startup_tokens',
    () => ({ case_001: 'tok-001', case_005: 'tok-005' }),
    ComputeScope.STARTUP,
  );
  assert.equal(await r.resolve('{{fn:startup_tokens.case_001}}', {}), 'tok-001');
  assert.equal(await r.resolve('{{fn:startup_tokens.case_005}}', {}), 'tok-005');
});

test('compute function dotted accessor missing returns literal under IGNORE', async () => {
  const r = new ContextResolver({ missingStrategy: MissingStrategy.IGNORE });
  r.getRegistry().register(
    'startup_tokens',
    () => ({ case_001: 'tok-001' }),
    ComputeScope.STARTUP,
  );
  // Accessor `.absent` doesn't exist in the result dict.
  assert.equal(
    await r.resolve('{{fn:startup_tokens.absent}}', {}),
    '{{fn:startup_tokens.absent}}',
  );
});

test('template dashed segment resolves from context', async () => {
  const r = new ContextResolver();
  const ctx = { request: { headers: { 'x-request-id': 'abc-123' } } };
  assert.equal(await r.resolve('{{request.headers.x-request-id}}', ctx), 'abc-123');
});

test('REQUEST fn during STARTUP scope returns literal template', async () => {
  const r = new ContextResolver();
  r.getRegistry().register('per_request', () => 'value', ComputeScope.REQUEST);
  assert.equal(await r.resolve('{{fn:per_request}}', {}, ComputeScope.STARTUP), '{{fn:per_request}}');
});

test('Security: forbidden path segments throw', async () => {
  const r = new ContextResolver();
  await assert.rejects(
    () => r.resolve('{{a.__proto__.x}}', { a: {} }),
    SecurityError,
  );
});

test('recursion: depth > maxDepth throws RecursionLimitError', async () => {
  const r = new ContextResolver({ maxDepth: 5 });
  // Build a 12-deep nested object.
  let nested = { leaf: 'x' };
  for (let i = 0; i < 12; i++) nested = { wrap: nested };
  await assert.rejects(() => r.resolveObject(nested, {}), RecursionLimitError);
});

test('recursion: maxDepth: 100 succeeds on 12-deep', async () => {
  const r = new ContextResolver({ maxDepth: 100 });
  let nested = { leaf: 'x' };
  for (let i = 0; i < 12; i++) nested = { wrap: nested };
  const out = await r.resolveObject(nested, {});
  assert.equal(typeof out, 'object');
});

test('createResolver returns a working resolver', async () => {
  const r = createResolver();
  assert.equal(typeof r.resolve, 'function');
  assert.equal(typeof r.resolveObject, 'function');
});
