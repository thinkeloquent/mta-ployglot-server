// @ts-nocheck
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sortByNumericPrefix } from "../contract/index.js";

export interface DiscoverResult {
  matched: string[];
}

// `matched` is files whose name ends with one of the addon's suffixes
// (e.g. ".lifecycle.mjs"). Anything else — helper modules (`_<name>.mjs`),
// dotfiles, dirs, unrelated source — is dropped silently. It is not the
// discoverer's job to flag unrelated files; the addon's later
// `log.skipped(file, reason)` is the channel for "matched but disqualified".
export async function discoverFiles(
  dir: string,
  suffixes: readonly string[],
): Promise<DiscoverResult> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return { matched: [] };
    throw err;
  }
  const matched: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (suffixes.some((s) => entry.name.endsWith(s))) {
      matched.push(join(dir, entry.name));
    }
  }
  return { matched: sortByNumericPrefix(matched) };
}
