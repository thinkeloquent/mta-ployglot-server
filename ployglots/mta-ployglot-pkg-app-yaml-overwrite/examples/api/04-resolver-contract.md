# API: Resolver contract (duck-type)

The applier expects an injected resolver to expose two async methods. Any object
that conforms to this shape is acceptable — including a hand-rolled stub, a
vault-backed handler, or the engine's `ContextResolver`. The applier never
imports the engine when `options.resolver` is provided.

## Contract

```ts
interface ResolverContract {
  resolve(expression: any, context?: any, scope?: any, depth?: number): Promise<any>
  resolveObject(obj: any, context?: any, scope?: any, depth?: number): Promise<any>
}
```

| Method | Required to handle |
| ------ | ------------------ |
| `resolve` | A single expression. May be a `{{...}}` template, a literal string, or any non-string (passed through). Returns a Promise. |
| `resolveObject` | A nested structure. Recurses into arrays + plain objects; calls `resolve` on string leaves; passes other leaves through. Returns a Promise. |

## What the applier guarantees

- It calls `resolver.resolveObject(node.overwrite_from_context, context, scope)` exactly once per `overwrite_from_context` section it encounters.
- It does **not** call `resolve` directly — only `resolveObject`.
- It does **not** mutate the `obj` argument it passes in.
- It awaits the returned Promise. Synchronous return values are also accepted (Promise.resolve wraps).

## What the resolver may do

- Resolve `{{path}}`, `{{fn:NAME}}`, `{{env.VAR}}`, or any other domain-specific syntax.
- Skip resolution entirely (return the input unchanged) — useful for tests.
- Throw — errors propagate to the `applyOverwritesFromContext` caller.

## Why this matters

The decoupling lets consumers:

- Swap the engine for a custom resolver (vault-backed, AWS-Secrets-backed, etc.) without touching the applier.
- Test the applier with a deterministic stub.
- Use the applier in environments where the engine is not desired (e.g. ahead-of-time
  config resolution where `{{env.VAR}}` is already inlined).
