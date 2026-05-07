#!/usr/bin/env python3
"""fix-pyproject-license.py — normalize pyproject.toml license declarations.

Poetry 2.2+ enforces PEP 639 SPDX strings for `[project.license]`. The legacy
PEP 621 table forms — `license = { text = "MIT" }` and `license = { file =
"LICENSE" }` — break `poetry lock` with:

    [project.license] must be of type string if [project.license-files] is
    defined.

This tool walks pyproject.toml files (default: `ployglots/`, `server/`,
`packages/`), detects the table forms, and:

  - Rewrites `text = "<spdx>"` form to the PEP 639 string form
    (e.g. `license = { text = "MIT" }` → `license = "MIT"`).
  - Reports `file = "..."` form as a manual-fix-required warning, since the
    correct conversion is project-specific (the SPDX expression must be
    chosen, and `license-files = ["..."]` may need to be added separately).

Default mode is dry-run: print proposed changes, exit 0.

Modes:
  --apply   actually write the rewrites; warn on `file =` form.
  --check   refuse to write; exit 1 if any table-form license exists. Used by
            release-preflight.sh and CI gates.
  (default) print proposed changes, exit 0.

Exit codes:
  0   no offending forms found, OR --apply succeeded.
  1   --check mode and offending forms exist, OR --apply hit a `file =` form
      it cannot safely convert.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tomllib
from pathlib import Path

# Match a table-form `license = { ... }` line. Captures the inner key
# (text|file) and quoted value. Section-awareness lives in the walker, not
# the regex — see _SECTION_RE below.
_TABLE_RE = re.compile(
    r'^([ \t]*license[ \t]*=[ \t]*)\{[ \t]*'
    r'(?P<kind>text|file)[ \t]*=[ \t]*'
    r'(?P<quote>["\'])(?P<value>[^"\']+)(?P=quote)'
    r'[ \t]*\}[ \t]*(?P<trailing>#.*)?$'
)

# Match a TOML section header (`[name]`, `[a.b.c]`, `[[array.of.tables]]`).
# We use it to track which section a `license = ...` line belongs to so we
# only rewrite under `[project]` or `[tool.poetry]` — the two sections
# Poetry's PEP 639 validator actually inspects.
_SECTION_RE = re.compile(r'^[ \t]*\[\[?(?P<name>[^\]]+)\]\]?[ \t]*(#.*)?$')

# Sections whose `license` key Poetry validates. Anything else we leave
# alone — third-party tools occasionally stash a table-form license under
# their own `[tool.<x>]` namespace and we shouldn't disturb that.
_VALIDATED_SECTIONS = frozenset({"project", "tool.poetry"})


def _is_validated_section(section: str | None) -> bool:
    """True if a `license = ...` under `section` is what Poetry/PEP 621 validates."""
    if section is None:
        return False
    return section in _VALIDATED_SECTIONS


def _path_dep_pyprojects(pyproject: Path) -> list[Path]:
    """Return every pyproject.toml referenced by a `path = "..."` dependency.

    Walks both `[tool.poetry.dependencies]` (poetry table form) and
    `[project.dependencies]`-adjacent path specs (less common). Resolves
    relative paths against the pyproject's own directory — the same way
    poetry does — so we cover exactly the set poetry validates on `lock`.
    """
    out: list[Path] = []
    try:
        with pyproject.open("rb") as f:
            doc = tomllib.load(f)
    except (OSError, tomllib.TOMLDecodeError):
        return out

    base = pyproject.parent

    def _add(raw: str) -> None:
        target = (base / raw).resolve()
        candidate = target / "pyproject.toml" if target.is_dir() else target
        if candidate.exists() and candidate.name == "pyproject.toml":
            out.append(candidate)

    poetry_deps = (doc.get("tool", {}).get("poetry", {}).get("dependencies", {}) or {})
    for spec in poetry_deps.values():
        if isinstance(spec, dict) and isinstance(spec.get("path"), str):
            _add(spec["path"])
    for group in (doc.get("tool", {}).get("poetry", {}).get("group", {}) or {}).values():
        if not isinstance(group, dict):
            continue
        for spec in (group.get("dependencies", {}) or {}).values():
            if isinstance(spec, dict) and isinstance(spec.get("path"), str):
                _add(spec["path"])
    return out


def _expand_via_path_deps(seeds: list[Path]) -> list[Path]:
    """Walk `path = ...` dep references transitively, returning a unique set."""
    seen: set[Path] = set()
    queue: list[Path] = list(seeds)
    out: list[Path] = []
    while queue:
        p = queue.pop()
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        out.append(p)
        queue.extend(_path_dep_pyprojects(p))
    return out


def _is_poetry_project(pyproject: Path) -> bool:
    """True iff this pyproject declares poetry config (table OR poetry-core backend)."""
    try:
        text = pyproject.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    return bool(re.search(r"^\[tool\.poetry\]|poetry\.core\.masonry\.api", text, re.MULTILINE))


def _iter_pyprojects(roots: list[Path]) -> list[Path]:
    """Yield every pyproject.toml under the given roots, following symlinks.

    Skips obvious noise (.venv, node_modules, dist) so we never lint files
    inside an installed dependency tree.
    """
    skip = {".venv", "node_modules", "dist", "build", "__pycache__"}
    found: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
            dirnames[:] = [d for d in dirnames if d not in skip]
            if "pyproject.toml" in filenames:
                found.append(Path(dirpath) / "pyproject.toml")
    # De-dup: symlinks can produce the same realpath via two routes.
    seen: set[Path] = set()
    unique: list[Path] = []
    for p in found:
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        unique.append(p)
    return unique


def _scan_file(path: Path) -> list[tuple[int, str, str, str]]:
    """Return [(lineno, kind, value, original_line), …] for every offending line.

    Only reports lines whose enclosing TOML section is one Poetry validates
    (`[project]` or `[tool.poetry]`); a `license = { … }` under `[tool.foo]`
    is left for that tool to handle.
    """
    hits: list[tuple[int, str, str, str]] = []
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        print(f"warn: cannot read {path}: {exc}", file=sys.stderr)
        return hits
    section: str | None = None
    for lineno, line in enumerate(text.splitlines(keepends=False), start=1):
        sm = _SECTION_RE.match(line)
        if sm:
            section = sm.group("name").strip()
            continue
        if not _is_validated_section(section):
            continue
        m = _TABLE_RE.match(line)
        if m:
            hits.append((lineno, m.group("kind"), m.group("value"), line))
    return hits


def _rewrite_file(path: Path, *, apply: bool) -> tuple[int, int]:
    """Rewrite text-form licenses in `path`. Returns (rewritten, file_form_count).

    `file =` form is left untouched and counted; the caller treats it as a
    failure under --apply (manual decision required).
    """
    rewritten = 0
    file_form = 0
    try:
        original = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        print(f"warn: cannot read {path}: {exc}", file=sys.stderr)
        return (0, 0)

    new_lines: list[str] = []
    section: str | None = None
    for line in original.splitlines(keepends=False):
        sm = _SECTION_RE.match(line)
        if sm:
            section = sm.group("name").strip()
            new_lines.append(line)
            continue
        if not _is_validated_section(section):
            new_lines.append(line)
            continue
        m = _TABLE_RE.match(line)
        if not m:
            new_lines.append(line)
            continue
        if m.group("kind") == "file":
            file_form += 1
            new_lines.append(line)
            continue
        # `text = "<value>"` → `license = "<value>"`. Canonicalize to double
        # quotes regardless of the input quote style.
        prefix = m.group(1)
        value = m.group("value")
        trailing = m.group("trailing") or ""
        replacement = f'{prefix}"{value}"' + (f"  {trailing}" if trailing else "")
        new_lines.append(replacement)
        rewritten += 1

    if rewritten and apply:
        # Preserve trailing newline behavior (TOML files almost always have one).
        suffix = "\n" if original.endswith("\n") else ""
        path.write_text("\n".join(new_lines) + suffix, encoding="utf-8")
    return (rewritten, file_form)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--apply", action="store_true",
        help="rewrite text-form licenses in place (default: dry-run)",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="exit 1 if any table-form license exists; never writes",
    )
    parser.add_argument(
        "--root", default=os.environ.get("ROOT_DIR", os.getcwd()),
        help="directory to anchor relative paths against (default: $ROOT_DIR or cwd)",
    )
    parser.add_argument(
        "paths", nargs="*",
        help="files or directories to scan (default: ployglots/, server/, packages/)",
    )
    parser.add_argument(
        "--no-follow-paths", action="store_true",
        help="skip transitive `path = ...` dep resolution (default: follow)",
    )
    parser.add_argument(
        "--clean-stale-locks", action="store_true",
        help="(--apply only) delete poetry.lock files in non-poetry directories",
    )
    args = parser.parse_args()

    if args.apply and args.check:
        parser.error("--apply and --check are mutually exclusive")

    root = Path(args.root).resolve()
    if args.paths:
        targets = [Path(p) if Path(p).is_absolute() else root / p for p in args.paths]
    else:
        targets = [root / d for d in ("ployglots", "server", "packages")]

    # Expand directories into pyproject.toml lists; keep explicit file args.
    pyprojects: list[Path] = []
    for t in targets:
        if t.is_file():
            pyprojects.append(t)
        elif t.is_dir():
            pyprojects.extend(_iter_pyprojects([t]))
        # Silently ignore non-existent paths — useful when only some default
        # roots exist (e.g. a sibling repo with no `server/`).

    # Follow `path = "..."` dependency references so we cover every pyproject
    # poetry actually walks during `lock`. Without this, a broken license in
    # a path-dep that lives outside ployglots/ / server/ / packages/ slips
    # through the static scan and the user gets "fix passed but error
    # remains" — exactly the failure mode this script exists to prevent.
    if not args.no_follow_paths and pyprojects:
        pyprojects = _expand_via_path_deps(pyprojects)

    if not pyprojects:
        print("no pyproject.toml files found under any target", file=sys.stderr)
        return 0

    text_form_files: list[Path] = []
    file_form_files: list[Path] = []
    rewritten_total = 0

    for path in pyprojects:
        rel = path.relative_to(root) if path.is_relative_to(root) else path
        if args.apply:
            n, fcount = _rewrite_file(path, apply=True)
            if n:
                rewritten_total += n
                text_form_files.append(path)
                print(f"fixed: {rel} ({n} text-form license entr{'y' if n == 1 else 'ies'} → string)")
            if fcount:
                file_form_files.append(path)
                print(
                    f"warn:  {rel} contains {fcount} `license = {{ file = ... }}` "
                    f"entr{'y' if fcount == 1 else 'ies'} — manual fix required",
                    file=sys.stderr,
                )
        else:
            hits = _scan_file(path)
            for lineno, kind, value, line in hits:
                if kind == "text":
                    text_form_files.append(path)
                    print(f"{rel}:{lineno}  {line}")
                    print(f"{rel}:{lineno}  → license = \"{value}\"")
                else:
                    file_form_files.append(path)
                    print(f"{rel}:{lineno}  {line}    [manual fix: choose SPDX + add license-files]", file=sys.stderr)

    # Stale-lock cleanup: a `poetry.lock` next to a pyproject.toml that
    # doesn't declare poetry is leftover from an earlier broken `py.install`
    # iteration. It can't influence pyproject validation, but it confuses
    # diagnostics and is dead weight. Scoped to the pyprojects we already
    # walked so we never roam the filesystem unconfined.
    cleaned_locks = 0
    if args.apply and args.clean_stale_locks:
        for path in pyprojects:
            lock = path.parent / "poetry.lock"
            if lock.exists() and not _is_poetry_project(path):
                rel = lock.relative_to(root) if lock.is_relative_to(root) else lock
                lock.unlink()
                cleaned_locks += 1
                print(f"cleaned: {rel} (stale — directory is not a poetry project)")

    # Summary + exit code.
    text_count = len({p for p in text_form_files})
    file_count = len({p for p in file_form_files})

    if args.check:
        if text_count or file_count:
            print(
                f"FAIL: {text_count} file(s) with text-form license, "
                f"{file_count} file(s) with file-form license",
                file=sys.stderr,
            )
            return 1
        print("pass: no table-form license declarations found")
        return 0

    if args.apply:
        if rewritten_total == 0 and file_count == 0:
            print("no changes needed: all licenses are PEP 639 string form")
        elif rewritten_total:
            print(f"\napplied: {rewritten_total} rewrite(s) across {text_count} file(s)")
        if file_count:
            print(f"\n{file_count} file(s) need a manual choice for `license = {{ file = ... }}` form.")
            return 1
        return 0

    # Default dry-run.
    if text_count or file_count:
        print(
            f"\ndry-run: {text_count} file(s) need text-form rewrites, "
            f"{file_count} file(s) need manual file-form fix.\n"
            f"  apply: {sys.argv[0]} --apply",
        )
    else:
        print("no changes needed: all licenses are PEP 639 string form")
    return 0


if __name__ == "__main__":
    sys.exit(main())
