import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { bootInProcess } from "./_boot.mjs";

describe("dynamic /healthz/app-yaml-file route", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await bootInProcess();
  });
  afterAll(async () => {
    if (ctx) await ctx.close();
  });

  it("returns merged + applied slice for endpoint.dev.yaml", async () => {
    const r = await fetch(
      `${ctx.baseUrl}/healthz/app-yaml-file/server/config/endpoint.dev.yaml`
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.raw.endpoints).toBeTruthy();
    expect(body.merged.endpoints).toBeTruthy();
    expect(body.applied.endpoints).toBeTruthy();
    expect(body.applied.intent_mapping.default_intent).toBe("llm001");
  });

  it("returns merged slice for an orphan-but-now-wired file", async () => {
    const r = await fetch(
      `${ctx.baseUrl}/healthz/app-yaml-file/server/config/database_schema.yaml`
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.merged.table_prefix).toBe("mta_");
  });

  it("rejects path traversal (400)", async () => {
    const r = await fetch(
      `${ctx.baseUrl}/healthz/app-yaml-file/server/config/..%2Fetc%2Fpasswd`
    );
    expect(r.status).toBe(400);
  });

  it("returns 404 for a missing file", async () => {
    const r = await fetch(
      `${ctx.baseUrl}/healthz/app-yaml-file/server/config/never_existed.yaml`
    );
    expect(r.status).toBe(404);
  });
});
