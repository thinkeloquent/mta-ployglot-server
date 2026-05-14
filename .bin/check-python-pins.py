#!/usr/bin/env python3
"""check-python-pins.py — enforce the canonical Python pin policy.

Reads the SSOT at `.bin/python-pins.toml` (lives in this repo so it survives
the release.yml `.claude` strip and never depends on a submodule init) and
validates that every project file in the workspace declares pinned packages
with the exact specifier the SSOT requires.

Files validated:
  pyproject.toml — [tool.poetry.dependencies], [tool.poetry.group.*.dependencies],
                   [project] dependencies, [project.optional-dependencies]
  requirements.txt / requirements-*.txt / constraints.txt

The CI-side counterpart of skills/python-pin-pkg-version (the agent-side).
Both read the same TOML; this script is the safety net for edits that bypass
the agent path.

Equivalence rules:
  - Two specifiers match when they are byte-identical after stripping
    surrounding whitespace.
  - A bare-version SSOT entry (e.g. "1.1.0") matches BOTH the Poetry caret
    form ("1.1.0") AND the explicit PEP 440 expansion from the SSOT's
    [poetry-caret-equivalents] table (">=1.1.0,<2.0.0").
  - Extras must match if the SSOT's [extras] table lists them. Missing
    extras are a violation; additional extras are a violation.
  - PEP 503 normalization (lowercase, hyphen) is applied to package names
    before lookup, so "PyYAML" and "pyyaml" resolve to the same pin.

Local usage:
  ./.bin/check-python-pins.py              # full workspace
  ./.bin/check-python-pins.py path/to/dir  # restrict scan

Exit codes:
  0  every checked file conforms
  1  one or more violations
  2  SSOT not found / unreadable
"""

from __future__ import annotations

import os
import re
import sys
import tomllib
from pathlib import Path

# ---------------------------------------------------------------------------
# Locate the SSOT.
#
# Canonical location is .bin/python-pins.toml in this repo — chosen so the
# file survives in every context: dev (sibling layout), CI (release.yml strips
# .claude/ before preflight), and any future consumer that copies the pattern.
# The agentfiles `python-pin-pkg-version` skill points back here rather than
# shipping its own copy, so there's exactly one TOML to keep in sync.
# ---------------------------------------------------------------------------
SSOT_CANDIDATES = [
    ".bin/python-pins.toml",
]

# ---------------------------------------------------------------------------
# PEP 503 name normalization.
# ---------------------------------------------------------------------------
_NAME_NORMALIZE_RE = re.compile(r"[-_.]+")


def normalize(name: str) -> str:
    return _NAME_NORMALIZE_RE.sub("-", name).lower()


# ---------------------------------------------------------------------------
# Specifier parsing helpers.
#
# We deliberately do NOT depend on `packaging` — that's a third-party install
# and this script must run on a vanilla Python 3.11 (stdlib only). Specifier
# matching is conservative: byte-for-byte equality after whitespace strip,
# plus the bare-version <-> caret-expansion equivalence.
# ---------------------------------------------------------------------------

# Match the leading version-specifier prefix (operators per PEP 440).
_SPEC_OPS_RE = re.compile(r"^([=!~<>]=?|===)")
# Match a PEP 508-style "name[extra,...]<spec>" requirement.
_REQ_LINE_RE = re.compile(
    r"""
    ^\s*
    (?P<name>[A-Za-z0-9][A-Za-z0-9._-]*)
    (?:\[(?P<extras>[^\]]*)\])?
    (?P<spec>.*)$
    """,
    re.VERBOSE,
)


def normalize_extras(extras_str: str | list[str] | None) -> tuple[str, ...]:
    if extras_str is None:
        return ()
    if isinstance(extras_str, list):
        items = extras_str
    else:
        items = [e.strip() for e in extras_str.split(",")]
    return tuple(sorted(e for e in items if e))


def specifiers_match(actual: str, ssot_spec: str, ssot_caret_equiv: str | None) -> bool:
    """Return True if `actual` is compatible with the SSOT pin.

    Equivalence rules:
      - exact match (whitespace-stripped) always passes
      - if SSOT spec is bare (no operator), the explicit caret expansion
        from [poetry-caret-equivalents] is also accepted
    """
    a = actual.strip()
    s = ssot_spec.strip()
    if a == s:
        return True
    # Bare-version equivalence.
    if not _SPEC_OPS_RE.match(s) and ssot_caret_equiv is not None:
        if a == ssot_caret_equiv.strip():
            return True
    return False


# ---------------------------------------------------------------------------
# Load SSOT.
# ---------------------------------------------------------------------------


def load_ssot(root: Path) -> tuple[dict, dict, dict, str]:
    """Return (pins, extras, caret_equivalents, python_version) from the SSOT."""
    for candidate in SSOT_CANDIDATES:
        p = (root / candidate).resolve()
        if p.is_file():
            with p.open("rb") as fh:
                data = tomllib.load(fh)
            pins = {normalize(k): v for k, v in data.get("pins", {}).items()}
            extras = {normalize(k): tuple(v) for k, v in data.get("extras", {}).items()}
            caret = {normalize(k): v for k, v in data.get("poetry-caret-equivalents", {}).items()}
            py_ver = data.get("meta", {}).get("python-version", "")
            return pins, extras, caret, py_ver
    print(
        "ERROR: python-pins.toml SSOT not found. Tried:\n  "
        + "\n  ".join(str((root / c).resolve()) for c in SSOT_CANDIDATES),
        file=sys.stderr,
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# pyproject.toml — Poetry + PEP 621.
# ---------------------------------------------------------------------------


def check_pyproject(
    path: Path,
    pins: dict,
    extras_map: dict,
    caret_equiv: dict,
    python_version: str,
    violations: list[str],
) -> None:
    try:
        with path.open("rb") as fh:
            data = tomllib.load(fh)
    except Exception as e:
        # Not our problem here — release-preflight gate 2 catches malformed TOML.
        return

    # --- Poetry ([tool.poetry.dependencies] + group dependencies) ----------
    poetry = data.get("tool", {}).get("poetry", {})
    poetry_dep_tables: list[tuple[str, dict]] = []
    if "dependencies" in poetry:
        poetry_dep_tables.append(("[tool.poetry.dependencies]", poetry["dependencies"]))
    for group_name, group in poetry.get("group", {}).items():
        if "dependencies" in group:
            poetry_dep_tables.append(
                (f"[tool.poetry.group.{group_name}.dependencies]", group["dependencies"])
            )

    for label, deps in poetry_dep_tables:
        for raw_name, value in deps.items():
            norm = normalize(raw_name)
            if norm == "python":
                if python_version and value != python_version:
                    violations.append(
                        f"{path}: {label} python = {value!r} — SSOT requires {python_version!r}"
                    )
                continue
            if norm not in pins:
                continue
            ssot_spec = pins[norm]
            ssot_caret = caret_equiv.get(norm)

            if isinstance(value, str):
                actual_spec = value
                actual_extras: tuple[str, ...] = ()
            elif isinstance(value, dict):
                actual_spec = value.get("version", "")
                actual_extras = normalize_extras(value.get("extras"))
            else:
                violations.append(
                    f"{path}: {label} {raw_name} = <unsupported form {type(value).__name__}>"
                )
                continue

            if not specifiers_match(actual_spec, ssot_spec, ssot_caret):
                violations.append(
                    f"{path}: {label} {raw_name} version {actual_spec!r} — SSOT requires {ssot_spec!r}"
                )
            expected_extras = extras_map.get(norm, ())
            if actual_extras != expected_extras:
                violations.append(
                    f"{path}: {label} {raw_name} extras {list(actual_extras)} — SSOT requires {list(expected_extras)}"
                )

    # --- PEP 621 ([project] dependencies + optional-dependencies) ----------
    project = data.get("project", {})
    pep621_lists: list[tuple[str, list[str]]] = []
    if "dependencies" in project:
        pep621_lists.append(("[project] dependencies", project["dependencies"]))
    for extra_name, dep_list in project.get("optional-dependencies", {}).items():
        pep621_lists.append(
            (f"[project.optional-dependencies.{extra_name}]", dep_list)
        )

    for label, dep_list in pep621_lists:
        for entry in dep_list:
            check_pep508_line(path, label, entry, pins, extras_map, caret_equiv, violations)

    # --- requires-python ---------------------------------------------------
    req_py = project.get("requires-python")
    if req_py and python_version and req_py != python_version:
        violations.append(
            f"{path}: [project] requires-python = {req_py!r} — SSOT requires {python_version!r}"
        )


# ---------------------------------------------------------------------------
# PEP 508 dependency line (used by PEP 621 lists and requirements.txt).
# ---------------------------------------------------------------------------


def check_pep508_line(
    path: Path,
    label: str,
    entry: str,
    pins: dict,
    extras_map: dict,
    caret_equiv: dict,
    violations: list[str],
) -> None:
    # Strip inline `; marker` clauses — we don't enforce on those.
    base = entry.split(";", 1)[0].strip()
    if not base or base.startswith("#"):
        return
    # `-r other.txt` / `-c constraint.txt` / `-e ...` lines.
    if base.startswith("-"):
        return
    m = _REQ_LINE_RE.match(base)
    if not m:
        return
    name = m.group("name")
    norm = normalize(name)
    if norm not in pins:
        return
    actual_extras = normalize_extras(m.group("extras"))
    actual_spec = m.group("spec").strip()
    ssot_spec = pins[norm]
    ssot_caret = caret_equiv.get(norm)
    if not specifiers_match(actual_spec, ssot_spec, ssot_caret):
        violations.append(
            f"{path}: {label} {name}{actual_spec!r} — SSOT requires {ssot_spec!r}"
        )
    expected_extras = extras_map.get(norm, ())
    if actual_extras != expected_extras:
        violations.append(
            f"{path}: {label} {name} extras {list(actual_extras)} — SSOT requires {list(expected_extras)}"
        )


# ---------------------------------------------------------------------------
# requirements.txt-family files.
# ---------------------------------------------------------------------------


def check_requirements(
    path: Path,
    pins: dict,
    extras_map: dict,
    caret_equiv: dict,
    violations: list[str],
) -> None:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return
    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        check_pep508_line(
            path, f"{path.name}", line, pins, extras_map, caret_equiv, violations
        )


# ---------------------------------------------------------------------------
# Walker.
# ---------------------------------------------------------------------------

EXCLUDE_DIR_PARTS = {".venv", "node_modules", "dist", "build", ".git", ".dev", "__pycache__"}


def iter_target_files(roots: list[Path]):
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
            # Prune.
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIR_PARTS]
            for fn in filenames:
                if fn == "pyproject.toml":
                    yield Path(dirpath) / fn, "pyproject"
                elif fn == "requirements.txt" or (
                    fn.startswith("requirements-") and fn.endswith(".txt")
                ) or fn == "constraints.txt":
                    yield Path(dirpath) / fn, "requirements"


# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------


def main(argv: list[str]) -> int:
    repo_root = Path(os.environ.get("ROOT_DIR") or Path(__file__).resolve().parents[1])
    os.chdir(repo_root)

    pins, extras_map, caret_equiv, python_version = load_ssot(repo_root)

    if argv:
        roots = [Path(a).resolve() for a in argv]
    else:
        # Default: scan ployglots/ (release-mode subtree dirs) + server/ +
        # any other repo-local Python project trees. Skip top-level scaffolding.
        roots = [
            p for p in [repo_root / "ployglots", repo_root / "server"] if p.exists()
        ]
        if not roots:
            roots = [repo_root]

    violations: list[str] = []
    files_seen = 0
    for path, kind in iter_target_files(roots):
        files_seen += 1
        if kind == "pyproject":
            check_pyproject(
                path, pins, extras_map, caret_equiv, python_version, violations
            )
        else:
            check_requirements(path, pins, extras_map, caret_equiv, violations)

    if violations:
        print(
            f"FAIL: python-pins policy — {len(violations)} violation(s) across {files_seen} file(s):",
            file=sys.stderr,
        )
        for v in violations:
            print(f"  {v}", file=sys.stderr)
        print(
            "\nFix: edit each violating file to use the SSOT specifier exactly.\n"
            "If the pin needs to MOVE, update python-pins.toml AND every "
            "consumer in the same PR (not just one sibling).\n"
            "SSOT: skills/python-pin-pkg-version/python-pins.toml",
            file=sys.stderr,
        )
        return 1

    print(f"pass: python-pins policy — {files_seen} file(s) checked, no violations")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
