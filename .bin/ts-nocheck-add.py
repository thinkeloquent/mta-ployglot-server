#!/usr/bin/env python3
"""Prepend `// @ts-nocheck` to every .ts/.tsx file under <root>.

Idempotent: files that already start with the marker are left untouched.
Skips .d.ts files (declaration files don't need a nocheck pragma) and any
directory commonly carrying build/install artifacts.

Usage:
    .bin/ts-nocheck-add.py [--dry-run] [<root>]
    .bin/ts-nocheck-add.py                  # scan CWD
    .bin/ts-nocheck-add.py ployglots/       # scope to one tree
    .bin/ts-nocheck-add.py --dry-run .      # plan only, no writes

Why: bulk-suppress strict TS errors during a temporary build (e.g. docker
image bring-up) without editing each file by hand. Python 3.11+ stdlib only.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

MARKER = "// @ts-nocheck"
SKIP_DIRS = {
    "node_modules",
    "dist",
    "build",
    ".venv",
    ".git",
    "__pycache__",
    ".docker-stage",
    ".dev",
    ".prod",
    ".turbo",
    ".next",
    ".cache",
}
EXTS = {".ts", ".tsx"}


def iter_ts_files(root: Path):
    # os.walk(followlinks=True) so symlinked ployglots/<sibling>/ trees are
    # walked into. pathlib.rglob does not follow symlinks.
    for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".d.ts"):
                continue
            if not name.endswith((".ts", ".tsx")):
                continue
            yield Path(dirpath) / name


def has_marker(path: Path) -> bool:
    with path.open("r", encoding="utf-8", errors="replace") as f:
        first = f.readline().rstrip("\n").rstrip("\r")
    return first.strip() == MARKER


def prepend_marker(path: Path) -> None:
    body = path.read_text(encoding="utf-8")
    path.write_text(f"{MARKER}\n{body}", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("root", nargs="?", default=".", help="directory to scan (default: cwd)")
    ap.add_argument("--dry-run", action="store_true", help="print plan without writing")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 1

    added = 0
    already = 0
    for path in iter_ts_files(root):
        if has_marker(path):
            already += 1
            continue
        rel = path.relative_to(root)
        if args.dry_run:
            print(f"[dry-run] would add @ts-nocheck -> {rel}")
        else:
            prepend_marker(path)
            print(f"added -> {rel}")
        added += 1

    print("---", file=sys.stderr)
    print(f"added{' (dry)' if args.dry_run else '    '}: {added}", file=sys.stderr)
    print(f"skipped (already had marker): {already}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
