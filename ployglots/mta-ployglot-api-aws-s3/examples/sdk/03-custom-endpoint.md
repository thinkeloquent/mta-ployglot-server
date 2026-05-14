# SDK Example: Custom endpoint + path-style (LocalStack / MinIO)

## Goal

Point the S3 client at a LocalStack or MinIO instance. This exercises
the `endpointUrl` → `forcePathStyle=true` auto-switch plus Python's
`verify_ssl=False` for self-signed-TLS environments.

## Prerequisites

- A running LocalStack (`localstack start`) or MinIO on `localhost:4566` / `localhost:9000`.
- Dummy credentials (`AKIAIOSFODNN7EXAMPLE` / `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

## Code (mjs)

```ts
import { CreateBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { buildS3Client, type SDKConfig } from "@mta/polyglot-aws-s3";

const config: SDKConfig = {
  bucketName: "local-bucket",
  region: "us-east-1",
  endpointUrl: "http://localhost:4566",      // forcePathStyle auto-flips to true
  awsAccessKeyId: "AKIAIOSFODNN7EXAMPLE",
  awsSecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  forcePathStyle: false,                      // honoured but overridden by endpointUrl presence
  connectTimeout: 10,
  readTimeout: 60,
  maxRetries: 3,
  verifySsl: false,
};

const handle = await buildS3Client(config);
try {
  await handle.client.send(new CreateBucketCommand({ Bucket: "local-bucket" }));
  const r = await handle.client.send(new ListBucketsCommand({}));
  console.log(r.Buckets?.map(b => b.Name));
} finally {
  await handle.destroy();
}
```

> **TLS with self-signed certs on Node:** the mjs SDK does not honour
> `verifySsl`. Set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your shell if
> your endpoint uses an untrusted cert.

## Code (py)

```py
import asyncio
from polyglot_aws_s3 import SDKConfig, build_s3_client

async def main():
    cfg = SDKConfig(
        bucket_name="local-bucket",
        region="us-east-1",
        endpoint_url="http://localhost:4566",   # force_path_style auto-flips to True
        aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
        aws_secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        verify_ssl=False,                        # acceptable for LocalStack / MinIO
    )
    async with build_s3_client(cfg) as client:
        await client.create_bucket(Bucket="local-bucket")
        r = await client.list_buckets()
        print([b["Name"] for b in r.get("Buckets", [])])

asyncio.run(main())
```

## Expected outcome

- URLs are path-style: `http://localhost:4566/local-bucket/...`, not `http://local-bucket.localhost:4566/...`.
- Node: `handle.client.config.forcePathStyle()` returns `true`.
- Python: `client.meta.config.s3["addressing_style"] == "path"`.
- Bucket is created (idempotent on LocalStack); `ListBuckets` returns it.

## Notes

- If you manually pass `forcePathStyle: false` while `endpointUrl` is set, the mjs builder still flips it to `true` (because LocalStack/MinIO don't support virtual-hosted-style). On Python, set `force_path_style=True` explicitly for the same effect — the builder treats `force_path_style OR endpoint_url` as path-style.
