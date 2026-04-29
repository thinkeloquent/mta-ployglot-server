#!/usr/bin/env node
// F04 / story 02 — overwrite_from_context overlay against openai headers, with
// inline ComputeRegistry stubs covering every {{fn:...}} ref in server.dev.yaml.
import { applyOverwritesFromContext } from "@ployglot/app-yaml-from-context";
import { ComputeRegistry, ComputeScope, MissingStrategy, createResolver } from "@ployglot/runtime-template-resolver";
import { resetAndInit, stable } from "./_init.mjs";

const inst = await resetAndInit();

const reg = new ComputeRegistry();
reg.register("compute_localhost_test_case_001_token", () => "token-001", ComputeScope.STARTUP);
reg.register("compute_localhost_test_case_005_token", () => "token-005", ComputeScope.STARTUP);
reg.register("startup_tokens", () => ({ case_001: "stk-001", case_005: "stk-005", timestamp_iso: "2026-04-27T00:00:00Z" }), ComputeScope.STARTUP);
reg.register("request_token_001", () => "req-001", ComputeScope.REQUEST);
reg.register("request_token_005", () => "req-005", ComputeScope.REQUEST);
reg.register("provider_api_keys", () => ({ gemini_openai: "k-gem", openai: "k-oai", anthropic: "k-ant", openai_embeddings: "k-emb", figma: "k-fig", github: "k-gh", jira: "k-jra", confluence: "k-cnf", saucelabs: "k-sl", servicenow: "k-sn", rally: "k-rly", statsig: "k-stat", sonar: "k-snr" }), ComputeScope.STARTUP);
reg.register("test_case_002", () => "Bearer k-jira", ComputeScope.REQUEST);
reg.register("test_case_002_1", () => "auth-aux", ComputeScope.REQUEST);
reg.register("example_auto_loaded", () => "auto-1", ComputeScope.STARTUP);

const resolver = createResolver({ registry: reg, missingStrategy: MissingStrategy.IGNORE });

const ctx = {
  app: { name: "demo", version: "1.2.3" },
  request: { headers: { "x-request-id": "req-001" } },
  env: process.env,
};

const before_headers = inst.getNested(["providers", "openai", "headers"]);
const merged = await applyOverwritesFromContext(inst.getAll(), { resolver, context: ctx });
const after_headers = merged.providers.openai.headers;

console.log(stable({
  before_openai_headers: before_headers,
  after_openai_headers: after_headers,
  invariants: {
    x_app_name_resolved: after_headers["X-App-Name"] === "demo",
    x_app_version_resolved: after_headers["X-App-Version"] === "1.2.3",
    x_computed_token_resolved: after_headers["X-Computed-Token"] === "token-001",
    x_server_start_left_as_literal: after_headers["X-Server-Start"] === "{{fn:startup_tokens.timestamp_iso}}",
    null_replaced: before_headers["X-App-Name"] === null && after_headers["X-App-Name"] === "demo",
  },
  sdk_note: "X-Server-Start uses composite-property syntax {{fn:startup_tokens.timestamp_iso}} which COMPUTE_PATTERN regex doesn't accept; resolver returns the literal string. Workaround: register a flat fn for the property OR extract programmatically.",
}));
