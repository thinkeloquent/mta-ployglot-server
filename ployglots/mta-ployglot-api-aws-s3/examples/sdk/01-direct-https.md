# SDK Example: Direct HTTPS with default settings

## Goal

Build an `S3Client` (Node) / aiobotocore client (Python) with just
`AWS_REGION` and credentials in the environment, then call
`ListBuckets`. No proxy, no custom endpoint — the plain happy path.

## Prerequisites

- Env:
  - `AWS_REGION=us-east-1`
  - `AWS_ACCESS_KEY_ID=...`
  - `AWS_SECRET_ACCESS_KEY=...`
- At least one bucket in the account (optional — `ListBuckets` succeeds with zero).

## Code (mjs)

```ts
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { buildS3Client, type SDKConfig } from "@mta/polyglot-aws-s3";

const config: SDKConfig = {
  bucketName: "placeholder",        // required by the validator — unused by ListBuckets
  region: process.env.AWS_REGION ?? "us-east-1",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  forcePathStyle: false,
  connectTimeout: 10,
  readTimeout: 60,
  maxRetries: 3,
  verifySsl: false,
};

const handle = await buildS3Client(config);
try {
  const r = await handle.client.send(new ListBucketsCommand({}));
  console.log(r.Buckets?.map(b => b.Name) ?? []);
} finally {
  await handle.destroy();
}
```

## Code (py)

```py
import asyncio, os
from polyglot_aws_s3 import SDKConfig, build_s3_client

async def main():
    cfg = SDKConfig(
        bucket_name="placeholder",
        region=os.environ.get("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )
    async with build_s3_client(cfg) as client:
        r = await client.list_buckets()
        print([b["Name"] for b in r.get("Buckets", [])])

asyncio.run(main())
```

## Expected outcome

- Stdout: a JSON array of bucket names (possibly empty).
- No network traffic touches a proxy (no `HttpsProxyAgent` is instantiated on Node; no `proxies=` passed to botocore on Python).
- Request uses virtual-hosted-style addressing (`https://<bucket>.s3.<region>.amazonaws.com/...`).

## Notes

- The `bucketName` / `bucket_name` field isn't used by `ListBuckets` — it's a validator guard so callers don't accidentally ship a config that can't hit any real bucket. Pass `{ requireBucket: false }` to `validateConfig` / `validate_config` if you need to skip the check.
- To use the default AWS credential chain instead of explicit keys, leave `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` unset — the builder will fall through to the vendor SDK's default provider chain.
