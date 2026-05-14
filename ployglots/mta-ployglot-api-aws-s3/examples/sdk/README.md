# SDK Examples

Programmatic usage of `@mta/polyglot-aws-s3` / `polyglot_aws_s3` — two
entry points for the implemented surface: `SDKConfig` (the option bag)
and `buildS3Client` / `build_s3_client` (the builder).

A third entry point — `verifyConnectivity` / `verify_connectivity` — is
documented in scenario 04 for the planned app-integration layer.

## Setup (mjs)

```bash
pnpm add @mta/polyglot-aws-s3
# optional: only needed if you set proxyUrl
pnpm add https-proxy-agent
```

```ts
import { buildS3Client, type SDKConfig } from "@mta/polyglot-aws-s3";

const config: SDKConfig = {
  bucketName: "my-bucket",
  region: "us-east-1",
  forcePathStyle: false,
  connectTimeout: 10,
  readTimeout: 60,
  maxRetries: 3,
  verifySsl: false,
};
const handle = await buildS3Client(config);
try { /* use handle.client directly */ } finally { await handle.destroy(); }
```

## Setup (py)

```bash
uv add polyglot-aws-s3
```

```py
from polyglot_aws_s3 import SDKConfig, build_s3_client

cfg = SDKConfig(bucket_name="my-bucket", region="us-east-1")
async with build_s3_client(cfg) as client:
    pass  # use `client` directly
```

## Scenarios

| #   | Scenario                                                                | Description                                                                          |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 01  | [Direct HTTPS with default settings](01-direct-https.md)                | Call `ListBuckets` against AWS with nothing but `AWS_REGION` + creds                  |
| 02  | [HTTPS via corporate proxy](02-https-via-proxy.md)                      | `proxyUrl` / `proxy_url` routes traffic through `HttpsProxyAgent` / botocore proxies |
| 03  | [Custom endpoint + path-style (LocalStack/MinIO)](03-custom-endpoint.md) | `endpointUrl` set → `forcePathStyle=true` auto; `verify_ssl=false` on py             |
| 04  | [Verify connectivity probe (planned)](04-verify-connectivity.md)        | `verifyConnectivity(config)` — lives in the app-integration layer, not this repo     |
