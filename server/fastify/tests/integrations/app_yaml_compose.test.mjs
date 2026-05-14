import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { bootInProcess } from "./_boot.mjs";

// Deviation from plan: vitest.config.mjs already targets `tests/**/*.test.mjs`
// (not `__tests__/integration/*.test.*`), and `main.mjs` does not export a
// `build_app` factory — the existing convention is to use `bootInProcess`,
// which spins up a real listening server on port 0.

describe("app-yaml compose chain", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await bootInProcess();
  });

  afterAll(async () => {
    if (ctx) await ctx.close();
  });

  it("returns a non-empty FetchConfig for intent llm001", async () => {
    const response = await fetch(`${ctx.baseUrl}/healthz/app-yaml/llm001`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
    expect(typeof body.data === "object").toBe(true);
  });

  it("returns 404 for an unknown intent", async () => {
    const response = await fetch(
      `${ctx.baseUrl}/healthz/app-yaml/nonexistent_intent`
    );
    expect(response.status).toBe(404);
  });
});
