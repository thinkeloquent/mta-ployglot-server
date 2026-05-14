# polyglot-aws-s3 (Python)

Polyglot AWS S3 HTTPS client builder — async context manager that yields
a configured `aiobotocore` S3 client honouring proxy URL, connect/read
timeouts, retry count, TLS verification, path-style addressing, and
custom endpoints.

Mirrors the Node sibling: [`@mta/polyglot-aws-s3`](../mjs/).

## Surface

| Name                  | Kind             | Description                                                              |
| --------------------- | ---------------- | ------------------------------------------------------------------------ |
| `SDKConfig`           | dataclass        | Option bag (proxy, timeouts, endpoint, region, creds, verify_ssl, …)     |
| `YamlStorageS3Config` | `TypedDict`      | Shape of a YAML `storage.s3` block consumed by an upstream config layer  |
| `validate_config`     | function         | Returns `list[str]` of validation errors (requires bucket_name by default) |
| `assert_valid_config` | function         | Raises `ValueError("Invalid S3 config: …")` on failure                   |
| `build_s3_client`     | async context mgr| Yields a configured aiobotocore S3 client; caller owns the lifecycle     |

## Build + test

```sh
cd packages/py && make install && make lint && make test
```

## Source plan

Tracked at
[`../../../AI-Agent-Plans/aws-s3-polyglot-plan-20260419-b7f3e2a1/`](../../../AI-Agent-Plans/aws-s3-polyglot-plan-20260419-b7f3e2a1/README.md).
Only Feature 02 (S3 client builder) is implemented here; Feature 01
(env-resolver) and Feature 03 (verification probe) are out of scope for
this package and belong to the app-integration plan.
