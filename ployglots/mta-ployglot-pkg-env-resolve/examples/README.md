# Examples

End-to-end, runnable samples for each surface this plan delivers. The package is library-only — there is no CLI surface, so the `cli/` subfolder is intentionally absent.

| Surface | Folder         | When to use                                                                                                 |
| ------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| SDK     | [`sdk/`](sdk/) | Embedding `env-resolve` (TS or Python) inside another codebase to look up config values.                    |
| API     | [`api/`](api/) | The package's public function-call contract — signatures, parameter semantics, failure modes per function.  |

## Conventions

- Every example shows both languages — TypeScript and Python — side-by-side. Cross-language behavior is identical by spec; the examples make that visible.
- Examples are self-contained: prerequisites, setup, the run, and expected output.
- Examples assume the plan has been fully implemented and `make ci` at the repo root passes.
- Examples double as smoke tests — the `examples/` tree should be runnable end-to-end as part of release validation.
