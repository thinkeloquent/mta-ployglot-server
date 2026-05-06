// Unit tests for _provider_config_echo._mask — credential + header masking.
// Twin of test_provider_config_echo_mask.py.
//
// Deviation from plan task: tests use vitest (the runtime's existing test
// runner) rather than node:test so they run via the existing `npm test`
// pipeline.

import { describe, it, expect } from "vitest";
import {
  _mask,
  MASKED_LITERAL,
} from "../../config/lifecycles/_provider_config_echo.mjs";

describe("_mask", () => {
  it("credential key at top level is masked", () => {
    const out = _mask({ endpoint_api_key: "leaked", base_url: "https://x" });
    expect(out).toEqual({ endpoint_api_key: MASKED_LITERAL, base_url: "https://x" });
  });

  it("credential key with underscore prefix is masked", () => {
    const out = _mask({ client_secret: "s", service_password: "p", user_token: "t" });
    expect(out.client_secret).toBe(MASKED_LITERAL);
    expect(out.service_password).toBe(MASKED_LITERAL);
    expect(out.user_token).toBe(MASKED_LITERAL);
  });

  it("credential key nested is masked", () => {
    const out = _mask({ a: { b: { api_token: "deep" } } });
    expect(out.a.b.api_token).toBe(MASKED_LITERAL);
  });

  it("authorization header is masked", () => {
    const out = _mask({ headers: { Authorization: "Bearer s", "Content-Type": "json" } });
    expect(out.headers.Authorization).toBe(MASKED_LITERAL);
    expect(out.headers["Content-Type"]).toBe("json");
  });

  it("authorization header case insensitive", () => {
    const out = _mask({ headers: { authorization: "Bearer s" } });
    expect(out.headers.authorization).toBe(MASKED_LITERAL);
  });

  it("X-API-Key header is masked", () => {
    const out = _mask({ headers: { "X-API-Key": "k", "X-Custom": "ok" } });
    expect(out.headers["X-API-Key"]).toBe(MASKED_LITERAL);
    expect(out.headers["X-Custom"]).toBe("ok");
  });

  it("non-credential keys pass through", () => {
    const inp = { base_url: "https://x", method: "GET", timeout_ms: 5000 };
    expect(_mask(inp)).toEqual(inp);
  });

  it("input is not mutated", () => {
    const inp = { endpoint_api_key: "leaked" };
    _mask(inp);
    expect(inp.endpoint_api_key).toBe("leaked");
  });

  it("list values are walked", () => {
    const out = _mask({ items: [{ api_key: "x" }, { id: "y" }] });
    expect(out.items[0].api_key).toBe(MASKED_LITERAL);
    expect(out.items[1].id).toBe("y");
  });
});
