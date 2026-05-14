import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { bootInProcess } from "./_boot.mjs";

const STAGES = ["raw", "merged", "applied", "derived"];

describe("/healthz/app-yaml-stage/:stage", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await bootInProcess();
  });
  afterAll(async () => {
    if (ctx) await ctx.close();
  });

  for (const stage of STAGES) {
    it(`${stage} returns 200 with data`, async () => {
      const r = await fetch(`${ctx.baseUrl}/healthz/app-yaml-stage/${stage}`);
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.ok).toBe(true);
      expect(body.stage).toBe(stage);
      expect(body.data).toBeTruthy();
    });
  }

  it("unknown stage returns 400 with valid_stages array", async () => {
    const r = await fetch(`${ctx.baseUrl}/healthz/app-yaml-stage/bogus`);
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.valid_stages).toEqual(STAGES);
  });

  it("merged keys are a subset of applied keys", async () => {
    const merged = await (
      await fetch(`${ctx.baseUrl}/healthz/app-yaml-stage/merged`)
    ).json();
    const applied = await (
      await fetch(`${ctx.baseUrl}/healthz/app-yaml-stage/applied`)
    ).json();
    for (const k of Object.keys(merged.data)) {
      expect(applied.data).toHaveProperty(k);
    }
  });

  it("derived exposes endpoint_keys + intent_resolutions", async () => {
    const r = await fetch(`${ctx.baseUrl}/healthz/app-yaml-stage/derived`);
    const body = await r.json();
    expect(Array.isArray(body.data.endpoint_keys)).toBe(true);
    expect(typeof body.data.intent_resolutions).toBe("object");
    expect(body.data.default_intent).toBe("llm001");
  });
});
