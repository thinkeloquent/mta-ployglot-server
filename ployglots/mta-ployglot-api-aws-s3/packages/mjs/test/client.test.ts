// @ts-nocheck
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { describe, expect, it, vi } from "vitest";
import { buildS3Client } from "../src/client.js";
import type { SDKConfig } from "../src/config.js";

function cfg(overrides: Partial<SDKConfig> = {}): SDKConfig {
  return {
    bucketName: "b",
    region: "us-east-1",
    forcePathStyle: false,
    connectTimeout: 10,
    readTimeout: 60,
    maxRetries: 3,
    verifySsl: false,
    ...overrides,
  };
}

async function resolveProvider<T>(v: T | (() => T | Promise<T>)): Promise<T> {
  return typeof v === "function" ? await (v as () => T | Promise<T>)() : v;
}

describe("buildS3Client", () => {
  it("applies forcePathStyle when endpointUrl is set and flag unset", async () => {
    const h = await buildS3Client(cfg({ endpointUrl: "http://localstack:4566" }));
    expect(await resolveProvider(h.client.config.forcePathStyle)).toBe(true);
    await h.destroy();
  });

  it("respects explicit forcePathStyle=true without an endpointUrl", async () => {
    const h = await buildS3Client(cfg({ forcePathStyle: true }));
    expect(await resolveProvider(h.client.config.forcePathStyle)).toBe(true);
    await h.destroy();
  });

  it("leaves forcePathStyle false when neither endpoint nor flag are set", async () => {
    const h = await buildS3Client(cfg());
    expect(await resolveProvider(h.client.config.forcePathStyle)).toBe(false);
    await h.destroy();
  });

  it("wires HttpsProxyAgent into the NodeHttpHandler when proxyUrl is set", async () => {
    const h = await buildS3Client(cfg({ proxyUrl: "http://proxy.local:8080" }));
    const handler = (await h.client.config.requestHandler) as NodeHttpHandler;
    expect(handler).toBeInstanceOf(NodeHttpHandler);
    const resolved = await (handler as unknown as { configProvider: Promise<Record<string, unknown>> }).configProvider;
    expect(resolved.httpAgent).toBeDefined();
    expect(resolved.httpsAgent).toBeDefined();
    expect((resolved.httpAgent as { constructor: { name: string } }).constructor.name).toBe("HttpsProxyAgent");
    expect((resolved.httpsAgent as { constructor: { name: string } }).constructor.name).toBe("HttpsProxyAgent");
    await h.destroy();
  });

  it("does not wire HttpsProxyAgent when proxyUrl is absent", async () => {
    const h = await buildS3Client(cfg());
    const handler = (await h.client.config.requestHandler) as NodeHttpHandler;
    const resolved = await (handler as unknown as { configProvider: Promise<Record<string, unknown>> }).configProvider;
    const httpAgentName = (resolved.httpAgent as { constructor?: { name?: string } } | undefined)?.constructor?.name;
    const httpsAgentName = (resolved.httpsAgent as { constructor?: { name?: string } } | undefined)?.constructor?.name;
    expect(httpAgentName).not.toBe("HttpsProxyAgent");
    expect(httpsAgentName).not.toBe("HttpsProxyAgent");
    await h.destroy();
  });

  it("passes maxAttempts through to the S3Client", async () => {
    const h = await buildS3Client(cfg({ maxRetries: 7 }));
    expect(await h.client.config.maxAttempts()).toBe(7);
    await h.destroy();
  });

  it("threads credentials when both access-key fields are set", async () => {
    const h = await buildS3Client(
      cfg({ awsAccessKeyId: "AK", awsSecretAccessKey: "SK" }),
    );
    const creds = await h.client.config.credentials();
    expect(creds.accessKeyId).toBe("AK");
    expect(creds.secretAccessKey).toBe("SK");
    await h.destroy();
  });

  it("destroy is idempotent (internal S3Client.destroy called at most once)", async () => {
    const h = await buildS3Client(cfg());
    const spy = vi.spyOn(h.client, "destroy");
    await h.destroy();
    await h.destroy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid config (missing bucketName)", async () => {
    const bad = { ...cfg(), bucketName: undefined };
    await expect(buildS3Client(bad as SDKConfig)).rejects.toThrow(/bucketName/);
  });

  it("multiplies seconds → milliseconds for the NodeHttpHandler timeouts", async () => {
    const h = await buildS3Client(cfg({ connectTimeout: 5, readTimeout: 42 }));
    const handler = (await h.client.config.requestHandler) as NodeHttpHandler;
    const resolved = (await (handler as unknown as {
      configProvider: Promise<{ connectionTimeout?: number; requestTimeout?: number }>;
    }).configProvider);
    expect(resolved.connectionTimeout).toBe(5_000);
    expect(resolved.requestTimeout).toBe(42_000);
    await h.destroy();
  });
});
