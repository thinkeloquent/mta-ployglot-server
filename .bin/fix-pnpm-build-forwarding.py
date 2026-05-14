#!/usr/bin/env python3
"""fix-pnpm-build-forwarding.py — wrap pnpm/npm wrapper scripts to absorb trailing args.

When a root package.json delegates a script into a sub-workspace via a wrapper
form like

    "build": "pnpm --filter \"./packages/mjs\" run build"

an outer caller that invokes `pnpm run build --if-present` (the `--if-present`
flag placed AFTER the script name) leaks `--if-present` through to the nested
invocation. The inner script ends up running

    tsc -p tsconfig.build.json --if-present

and tsc rejects the unknown flag. Same shape applies to `npm run <name>
--workspaces` and `npm run -w <pkg> <subscript>`.

The defensive fix is to wrap the script body in `sh -c '...'`. The shell's
`sh -c CMD [arg0 arg1 ...]` form puts trailing args in `$0`/`$1`/..., unused
by the body, so they never reach the inner tool.

Modes:
  (default)  dry-run: print proposed changes, exit 0.
  --apply    rewrite scripts in place; exit 0 on success.
  --check    exit 1 if any unsafe wrappers remain; never writes. Used in CI.

Exit codes:
  0   no offending scripts found, OR --apply succeeded.
  1   --check mode and offending scripts exist.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

# Patterns that indicate a script body delegates into a sub-workspace via a
# nested pnpm/npm invocation. When that happens, trailing args appended by an
# outer `pnpm run <name> --if-present` caller leak into the inner tool.
#
# Note on word boundaries: long flags like `--workspaces` are NOT preceded by
# `\b` because `\b` only matches at a word-vs-non-word transition, and the
# space-to-`-` boundary is non-word-to-non-word. Trailing `\b` is fine
# because the final letter-to-space transition does match.
_UNSAFE_PATTERNS = (
    # pnpm --filter <glob> run <name>  /  pnpm -F <glob> run <name>
    re.compile(r"\bpnpm\b[^|&;]*?(?:--filter\b|-F\b)[^|&;]*?\brun\s+\S"),
    # pnpm -r run <name>  /  pnpm --recursive run <name>
    re.compile(r"\bpnpm\b[^|&;]*?(?:--recursive\b|-r\b)[^|&;]*?\brun\s+\S"),
    # pnpm run <name> --filter <glob>  (less common, same hazard)
    re.compile(r"\bpnpm\s+run\s+\S[^|&;]*?--filter\b"),
    # npm run <name> --workspaces  /  npm test --workspaces
    re.compile(r"\bnpm\s+(?:run\s+)?\S[^|&;]*?--workspaces\b"),
    # npm run -w <pkg> <subscript>  (forwards via npm's workspace dispatcher)
    re.compile(r"\bnpm\s+run\s+-w\b"),
)

# A body that's already wrapped in `sh -c '...'` / `bash -c '...'` absorbs
# trailing args via positional $0/$1 — no rewrite needed.
_SAFE_WRAPPER = re.compile(r"^\s*(?:sh|bash)\s+-c\s+['\"]")

# Directories to skip when walking for package.json files. node_modules is the
# big one — every dep has a package.json and rewriting those would be wrong.
_SKIP_DIRS = frozenset(
    {"node_modules", ".dev", ".prod", "dist", "build", ".git", "__pycache__", ".venv"}
)


def _is_unsafe(body: str) -> bool:
    """True if `body` is a wrapper script that would leak trailing args."""
    if _SAFE_WRAPPER.match(body):
        return False
    return any(pat.search(body) for pat in _UNSAFE_PATTERNS)


def _wrap(body: str) -> str:
    """Wrap `body` in `sh -c '...'`, POSIX-escaping any internal single quotes."""
    # POSIX single-quote escape: close, escape literal, reopen → ' -> '\''
    escaped = body.replace("'", "'\\''")
    return f"sh -c '{escaped}'"


def _iter_package_jsons(roots: list[Path]) -> list[Path]:
    """Yield every package.json under the given roots, following symlinks.

    Each `ployglots/<sibling>` is typically a symlink to `../<sibling>` on a
    fresh checkout, so we must follow links. node_modules / dist / .dev are
    skipped — see `_SKIP_DIRS`.
    """
    found: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        if root.is_file() and root.name == "package.json":
            found.append(root)
            continue
        for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
            if "package.json" in filenames:
                found.append(Path(dirpath) / "package.json")
    # De-dup by realpath — symlinks can produce the same target via two routes.
    seen: set[Path] = set()
    unique: list[Path] = []
    for p in found:
        try:
            rp = p.resolve()
        except OSError:
            continue
        if rp in seen:
            continue
        seen.add(rp)
        unique.append(p)
    return unique


def _scan_file(path: Path) -> list[tuple[str, str]]:
    """Return `[(script_name, body), …]` for every unsafe entry in `path`."""
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(f"warn: cannot parse {path}: {exc}", file=sys.stderr)
        return []
    if not isinstance(doc, dict):
        return []
    scripts = doc.get("scripts")
    if not isinstance(scripts, dict):
        return []
    return [
        (name, body)
        for name, body in scripts.items()
        if isinstance(body, str) and _is_unsafe(body)
    ]


def _rewrite_file(path: Path) -> int:
    """Rewrite unsafe scripts in `path`. Returns the count of scripts wrapped."""
    try:
        original = path.read_text(encoding="utf-8")
        doc = json.loads(original)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(f"warn: cannot parse {path}: {exc}", file=sys.stderr)
        return 0
    if not isinstance(doc, dict):
        return 0
    scripts = doc.get("scripts")
    if not isinstance(scripts, dict):
        return 0
    rewritten = 0
    for name, body in list(scripts.items()):
        if isinstance(body, str) and _is_unsafe(body):
            scripts[name] = _wrap(body)
            rewritten += 1
    if rewritten == 0:
        return 0
    new_text = json.dumps(doc, indent=2, ensure_ascii=False)
    if original.endswith("\n"):
        new_text += "\n"
    path.write_text(new_text, encoding="utf-8")
    return rewritten


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply", action="store_true",
        help="rewrite scripts in place (default: dry-run)",
    )
    mode.add_argument(
        "--check", action="store_true",
        help="exit 1 if any unsafe wrapper scripts exist; never writes",
    )
    parser.add_argument(
        "--root", default=os.environ.get("ROOT_DIR", os.getcwd()),
        help="anchor for relative paths (default: $ROOT_DIR or cwd)",
    )
    parser.add_argument(
        "paths", nargs="*",
        help="files or directories to scan (default: ployglots/)",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if args.paths:
        targets = [
            Path(p) if Path(p).is_absolute() else root / p
            for p in args.paths
        ]
    else:
        targets = [root / "ployglots"]

    package_jsons = _iter_package_jsons(targets)
    if not package_jsons:
        print("no package.json files found under target paths", file=sys.stderr)
        return 0

    unsafe: dict[Path, list[tuple[str, str]]] = {}
    for path in package_jsons:
        hits = _scan_file(path)
        if hits:
            unsafe[path] = hits

    if not unsafe:
        if args.check:
            print("pass: no unsafe pnpm/npm wrapper scripts found")
        else:
            print("no changes needed: every wrapper script is already absorbed")
        return 0

    if args.check:
        for path, hits in unsafe.items():
            rel = path.relative_to(root) if path.is_relative_to(root) else path
            for name, body in hits:
                print(f"{rel}: scripts.{name} = {body!r}", file=sys.stderr)
        print(
            f"FAIL: {len(unsafe)} file(s) contain unsafe pnpm/npm wrapper scripts.\n"
            f"  fix: ./.bin/fix-pnpm-build-forwarding.py --apply",
            file=sys.stderr,
        )
        return 1

    if args.apply:
        total = 0
        for path in unsafe:
            n = _rewrite_file(path)
            if n:
                rel = path.relative_to(root) if path.is_relative_to(root) else path
                noun = "script" if n == 1 else "scripts"
                print(f"fixed: {rel} ({n} {noun} wrapped in sh -c)")
                total += n
        print(f"\napplied: {total} rewrite(s) across {len(unsafe)} file(s)")
        return 0

    # Default dry-run.
    for path, hits in unsafe.items():
        rel = path.relative_to(root) if path.is_relative_to(root) else path
        for name, body in hits:
            print(f"{rel}: scripts.{name}")
            print(f"  before: {body}")
            print(f"  after:  {_wrap(body)}")
    print(
        f"\ndry-run: {len(unsafe)} file(s) need wrapping. "
        f"Re-run with --apply to fix, or --check to gate in CI."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
