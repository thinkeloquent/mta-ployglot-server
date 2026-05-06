import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { bootInProcess } from "./_boot.mjs";

describe("orphan yaml pipeline coverage", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await bootInProcess();
  });
  afterAll(async () => {
    if (ctx) await ctx.close();
  });

  it("includes database_schema.yaml keys in merged config", () => {
    const config = ctx.server.app_yaml_config.getAll();
    expect(config.table_prefix).toBe("mta_");
    expect(config.fallback_schema).toBe("public");
    expect(typeof config.define_defaults).toBe("object");
  });

  it("includes llm_rag.yml keys", () => {
    const config = ctx.server.app_yaml_config.getAll();
    expect(typeof config.component_ingest).toBe("object");
  });

  it("includes vite.yaml keys", () => {
    const config = ctx.server.app_yaml_config.getAll();
    expect(typeof config.default_envs).toBe("object");
  });
});
