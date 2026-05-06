// Unit tests for buildEcho — twin of test_provider_config_echo_build.py.
// Uses vitest (existing test runner) and the upstream
// @ployglot/runtime-template-resolver to build a stub resolver.

import { describe, it, expect } from "vitest";
import {
  ComputeRegistry,
  ComputeScope,
  MissingStrategy,
  createResolver,
} from "@ployglot/runtime-template-resolver";
import {
  buildEcho,
  MASKED_LITERAL,
} from "../../config/lifecycles/_provider_config_echo.mjs";

function stubRequest(headers) {
  return { headers, method: "GET", url: "/healthz/integrations/test" };
}

function makeResolverWithToken(providerToToken, scope = ComputeScope.STARTUP) {
  const reg = new ComputeRegistry();
  reg.register("provider_api_keys", () => providerToToken, scope);
  return createResolver({ registry: reg, missingStrategy: MissingStrategy.IGNORE });
}

describe("buildEcho", () => {
  it("returns null when provider missing", async () => {
    const out = await buildEcho({
      provider: "absent",
      request: stubRequest({}),
      cfg: { providers: {} },
      resolver: makeResolverWithToken({}),
    });
    expect(out).toBeNull();
  });

  it("returns null when cfg is null", async () => {
    const out = await buildEcho({
      provider: "p",
      request: stubRequest({}),
      cfg: null,
      resolver: makeResolverWithToken({}),
    });
    expect(out).toBeNull();
  });

  it("returns null when slice is not an object", async () => {
    const out = await buildEcho({
      provider: "p",
      request: stubRequest({}),
      cfg: { providers: { p: "not-a-dict" } },
      resolver: makeResolverWithToken({}),
    });
    expect(out).toBeNull();
  });

  it("returns null when slice is an array", async () => {
    const out = await buildEcho({
      provider: "p",
      request: stubRequest({}),
      cfg: { providers: { p: ["array"] } },
      resolver: makeResolverWithToken({}),
    });
    expect(out).toBeNull();
  });

  it("resolves request id then masks credential", async () => {
    const cfg = {
      app: { name: "test" },
      providers: {
        p: {
          base_url: "https://x",
          endpoint_api_key: "{{fn:provider_api_keys.p}}",
          headers: {
            "X-Request-Id": "{{request.headers.x-request-id}}",
            Authorization: "Bearer should-mask",
          },
        },
      },
    };
    const out = await buildEcho({
      provider: "p",
      request: stubRequest({ "x-request-id": "rid-123" }),
      cfg,
      resolver: makeResolverWithToken({ p: "real-token" }),
    });

    expect(out).not.toBeNull();
    expect(out.base_url).toBe("https://x");
    expect(out.endpoint_api_key).toBe(MASKED_LITERAL);
    expect(out.headers["X-Request-Id"]).toBe("rid-123");
    expect(out.headers.Authorization).toBe(MASKED_LITERAL);
  });

  it("invalid trigger throws TypeError", async () => {
    await expect(
      buildEcho({
        provider: "p",
        request: stubRequest({}),
        cfg: { providers: { p: {} } },
        resolver: makeResolverWithToken({}),
        trigger: "bogus",
      }),
    ).rejects.toThrow(TypeError);
  });

  it("trigger Both runs two passes", async () => {
    const reg = new ComputeRegistry();
    reg.register("boot_value", () => "BOOT", ComputeScope.STARTUP);
    const resolver = createResolver({
      registry: reg,
      missingStrategy: MissingStrategy.IGNORE,
    });
    const cfg = {
      providers: {
        p: {
          base_url: "https://x",
          boot_field: "{{fn:boot_value}}",
          request_field: "{{request.headers.x-request-id}}",
        },
      },
    };
    const out = await buildEcho({
      provider: "p",
      request: stubRequest({ "x-request-id": "rid-both" }),
      cfg,
      resolver,
      trigger: "Both",
    });
    expect(out).not.toBeNull();
    expect(out.boot_field).toBe("BOOT");
    expect(out.request_field).toBe("rid-both");
  });
});
