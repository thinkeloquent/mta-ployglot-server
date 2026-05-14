# Examples

End-to-end runnable samples for the one surface this repo delivers — a
programmatic library.

| Surface | Folder            | When to use                                                         |
| ------- | ----------------- | ------------------------------------------------------------------- |
| SDK     | [`sdk/`](sdk/)    | Embedding `@mta/polyglot-aws-s3` / `polyglot_aws_s3` in app code     |

There is no CLI and no HTTP API — the `cli/` and `api/` folders are
intentionally absent.

## Implemented vs planned

The plan ([`../../AI-Agent-Plans/aws-s3-polyglot-plan-20260419-b7f3e2a1/`](../../AI-Agent-Plans/aws-s3-polyglot-plan-20260419-b7f3e2a1/README.md))
covers three features. Only Feature 02 (the builder) is implemented in
this repo:

| Example | Uses                                          | Runnable today? |
| ------- | --------------------------------------------- | --------------- |
| 01      | `SDKConfig` + `buildS3Client`                 | ✅               |
| 02      | `SDKConfig` + `buildS3Client` (with proxy)    | ✅               |
| 03      | `SDKConfig` + `buildS3Client` (LocalStack)    | ✅               |
| 04      | `verifyConnectivity` (Feature 03, planned)    | ❌ — see plan   |

Example 04 documents the planned `verifyConnectivity` surface for the
app-integration layer; it will not run against this repo alone.

## Conventions

- Every example is self-contained: prerequisites, setup, the run, and expected output.
- Examples assume `AWS_*` env is set for credentials.
- Examples 01–03 double as smoke tests — every file under `examples/sdk/` should run clean end-to-end.
