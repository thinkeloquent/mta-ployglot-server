# SDK Example: HTTPS via corporate proxy

## Goal

Route all outbound S3 traffic through a caller-specified HTTPS proxy.
Exercises the lazy-loaded `HttpsProxyAgent` on Node and botocore's
`proxies={http, https}` on Python.

## Prerequisites

- A reachable proxy URL (e.g. `http://proxy.corp:8080`).
- `AWS_REGION` + credentials.

## Code (mjs)

```ts
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { buildS3Client, type SDKConfig } from "@mta/polyglot-aws-s3";

const config: SDKConfig = {
  bucketName: "placeholder",
  region: process.env.AWS_REGION ?? "us-east-1",
  proxyUrl: "http://proxy.corp:8080",
  forcePathStyle: false,
  connectTimeout: 10,
  readTimeout: 60,
  maxRetries: 3,
  verifySsl: false,
};

const handle = await buildS3Client(config);
try {
  const r = await handle.client.send(new ListBucketsCommand({}));
  console.log({ bucketCount: r.Buckets?.length ?? 0 });
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
        proxy_url="http://proxy.corp:8080",
    )
    async with build_s3_client(cfg) as client:
        r = await client.list_buckets()
        print({"bucket_count": len(r.get("Buckets", []))})

asyncio.run(main())
```

## Expected outcome

- The proxy at `proxy.corp:8080` sees a `CONNECT s3.<region>.amazonaws.com:443 HTTP/1.1` tunnelling request for every S3 call.
- Node: `handle.client.config.requestHandler` is a `NodeHttpHandler` whose `httpAgent`/`httpsAgent` are `HttpsProxyAgent` instances.
- Python: `client.meta.config.proxies === {"http": "http://proxy.corp:8080", "https": "http://proxy.corp:8080"}`.

## Notes

- The Node `https-proxy-agent` dep is an **optional dependency** — if not installed, the dynamic `import()` will throw only when `proxyUrl` is set. Install it on the consumer side with `pnpm add https-proxy-agent` when you need proxy support.
