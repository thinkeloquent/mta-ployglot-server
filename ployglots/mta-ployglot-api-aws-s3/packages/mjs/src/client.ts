// @ts-nocheck
import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { assertValidConfig, type SDKConfig } from "./config.js";

export interface S3ClientHandle {
  client: S3Client;
  destroy: () => Promise<void>;
  config: SDKConfig;
}

type NodeHttpHandlerOptions = ConstructorParameters<typeof NodeHttpHandler>[0];

export async function buildS3Client(config: SDKConfig): Promise<S3ClientHandle> {
  assertValidConfig(config);

  const clientConfig: S3ClientConfig = {
    region: config.region,
    maxAttempts: config.maxRetries,
  };
  if (config.endpointUrl) clientConfig.endpoint = config.endpointUrl;
  clientConfig.forcePathStyle = config.forcePathStyle || !!config.endpointUrl;
  if (config.awsAccessKeyId && config.awsSecretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    };
  }

  const handlerOptions: NodeHttpHandlerOptions = {
    connectionTimeout: config.connectTimeout * 1000,
    requestTimeout: config.readTimeout * 1000,
  };

  if (config.proxyUrl) {
    const mod = await import("https-proxy-agent");
    const agent = new mod.HttpsProxyAgent(config.proxyUrl);
    handlerOptions.httpAgent = agent as never;
    handlerOptions.httpsAgent = agent as never;
  }
  clientConfig.requestHandler = new NodeHttpHandler(handlerOptions);

  const client = new S3Client(clientConfig);
  let destroyed = false;
  return {
    client,
    config,
    destroy: async () => {
      if (destroyed) return;
      destroyed = true;
      client.destroy();
    },
  };
}
