// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SDK_CONFIG,
  assertValidConfig,
  validateConfig,
  type SDKConfig,
} from "../src/config.js";

const baseValid: SDKConfig = {
  bucketName: "my-bucket",
  region: "us-east-1",
  forcePathStyle: false,
  connectTimeout: 10,
  readTimeout: 60,
  maxRetries: 3,
  verifySsl: false,
};

describe("DEFAULT_SDK_CONFIG", () => {
  it("carries the documented defaults", () => {
    expect(DEFAULT_SDK_CONFIG.region).toBe("us-east-1");
    expect(DEFAULT_SDK_CONFIG.forcePathStyle).toBe(false);
    expect(DEFAULT_SDK_CONFIG.verifySsl).toBe(false);
    expect(DEFAULT_SDK_CONFIG.connectTimeout).toBe(10);
    expect(DEFAULT_SDK_CONFIG.readTimeout).toBe(60);
    expect(DEFAULT_SDK_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_SDK_CONFIG.bucketName).toBeUndefined();
    expect(DEFAULT_SDK_CONFIG.endpointUrl).toBeUndefined();
    expect(DEFAULT_SDK_CONFIG.proxyUrl).toBeUndefined();
  });
});

describe("validateConfig", () => {
  it("accepts a fully-populated config", () => {
    expect(validateConfig(baseValid)).toEqual([]);
  });

  it("flags missing bucketName when requireBucket is true", () => {
    const { bucketName: _drop, ...noBucket } = baseValid;
    void _drop;
    const errs = validateConfig(noBucket as SDKConfig);
    expect(errs).toContain("bucketName is required");
  });

  it("does not flag missing bucketName when requireBucket is false", () => {
    const { bucketName: _drop, ...noBucket } = baseValid;
    void _drop;
    const errs = validateConfig(noBucket as SDKConfig, { requireBucket: false });
    expect(errs).toEqual([]);
  });

  it("flags invalid endpointUrl scheme", () => {
    const cfg = { ...baseValid, endpointUrl: "bad://x" };
    const errs = validateConfig(cfg);
    expect(errs).toEqual([
      "endpointUrl must start with http:// or https://: bad://x",
    ]);
  });

  it("accepts http:// and https:// endpointUrl", () => {
    expect(validateConfig({ ...baseValid, endpointUrl: "http://localstack:4566" })).toEqual([]);
    expect(validateConfig({ ...baseValid, endpointUrl: "https://s3.example.com" })).toEqual([]);
  });

  it("flags invalid proxyUrl scheme", () => {
    const cfg = { ...baseValid, proxyUrl: "socks5://h:1080" };
    const errs = validateConfig(cfg);
    expect(errs).toEqual([
      "proxyUrl must start with http:// or https://: socks5://h:1080",
    ]);
  });

  it("collects multiple errors", () => {
    const { bucketName: _drop, ...noBucket } = baseValid;
    void _drop;
    const cfg = { ...noBucket, endpointUrl: "ftp://x", proxyUrl: "bad://y" } as SDKConfig;
    const errs = validateConfig(cfg);
    expect(errs).toHaveLength(3);
  });
});

describe("assertValidConfig", () => {
  it("returns undefined for a valid config", () => {
    expect(assertValidConfig(baseValid)).toBeUndefined();
  });

  it("throws for an invalid config", () => {
    expect(() => assertValidConfig({ ...baseValid, endpointUrl: "bad://x" })).toThrow(
      /endpointUrl must start with http/,
    );
  });

  it("prefixes thrown messages with 'Invalid S3 config'", () => {
    const { bucketName: _drop, ...noBucket } = baseValid;
    void _drop;
    expect(() => assertValidConfig(noBucket as SDKConfig)).toThrow(/^Invalid S3 config: /);
  });
});
