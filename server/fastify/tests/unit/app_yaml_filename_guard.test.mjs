import { describe, it, expect } from "vitest";
import { assertSafeBasename } from "../../config/routes/_app_yaml_filename_guard.mjs";

describe("assertSafeBasename", () => {
  for (const ok of [
    "endpoint.dev.yaml",
    "base.yml",
    "feature_flags.yml",
    "database_schema.yaml",
    "llm_rag.yml",
    "vite.yaml",
    "server.dev.yaml",
    "api-release-date.yml",
    "security.yml",
    "a.yaml",
  ]) {
    it(`accepts ${ok}`, () => {
      expect(assertSafeBasename(ok)).toBe(ok);
    });
  }

  for (const bad of [
    "",
    "../base.yml",
    "foo/bar.yaml",
    "foo\\bar.yaml",
    ".hidden.yaml",
    "no-extension",
    "trailing.dot.",
    "%2e%2e%2fbase.yml",
    "base.yml/../etc/passwd",
    "base.txt",
  ]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      expect(() => assertSafeBasename(bad)).toThrow();
    });
  }
});
