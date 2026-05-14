# SDK Example: Verify connectivity probe (planned)

> **Not implemented in this repo.** `verifyConnectivity` /
> `verify_connectivity` is Feature 03 of the tracked plan and lives in
> the app-integration layer. This file documents the planned surface
> for cross-repo reference; it will not run against
> `@mta/polyglot-aws-s3` / `polyglot_aws_s3` alone.

## Goal

Run `verifyConnectivity(config)` / `verify_connectivity(config)` to
confirm a given `SDKConfig` can actually reach S3 through the
configured proxy/endpoint/timeout stack. Returns a structured
`VerifyResult` that's safe to log (credentials masked).

## Prerequisites

- Example 01 env OR a custom-endpoint setup from example 03.
- The app-integration package that ships `verifyConnectivity`.

## Code (mjs)

```ts
import { buildS3Client, type SDKConfig } from "@mta/polyglot-aws-s3";
// from the app-integration package (planned):
import { verifyConnectivity } from "@internal/aws-s3-verify";

const config: SDKConfig = { /* as in example 01 */ } as SDKConfig;
const result = await verifyConnectivity(config);
console.log(JSON.stringify(result, null, 2));
process.exit(result.connected ? 0 : 1);
```

## Code (py)

```py
import asyncio, json
from dataclasses import asdict
from polyglot_aws_s3 import SDKConfig
# from the app-integration package (planned):
from aws_s3_verify import verify_connectivity

async def main():
    cfg = SDKConfig(bucket_name="placeholder")  # + region + creds
    result = await verify_connectivity(cfg)
    print(json.dumps(asdict(result), indent=2, default=str))
    raise SystemExit(0 if result.connected else 1)

asyncio.run(main())
```

## Expected outcome (success)

```json
{
  "connected": true,
  "latency_ms": 142.7,
  "bucketCount": 3,
  "resolvedConfig": {
    "bucketName": "placeholder",
    "region": "us-east-1",
    "awsAccessKeyId": "***",
    "awsSecretAccessKey": "***",
    "endpointUrl": null,
    "forcePathStyle": false,
    "proxyUrl": null,
    "connectTimeout": 10,
    "readTimeout": 60,
    "maxRetries": 3,
    "verifySsl": false
  }
}
```

## Expected outcome (failure)

```json
{
  "connected": false,
  "latency_ms": 1007.3,
  "resolvedConfig": { "...": "(masked config)" },
  "error": {
    "name": "TimeoutError",
    "message": "Connection timeout after 1s",
    "code": null
  }
}
```

## Notes

- Output is the canonical log format for health dashboards — credentials are always `"***"`, never raw.
- Use this as the body of a `/healthz/s3` endpoint if you later add one; the tracked plan does not include that wiring, but the primitive is ready once the app-integration layer lands.
- Exit code is `0` when `connected === true`, `1` otherwise — suitable for CI smoke checks.
