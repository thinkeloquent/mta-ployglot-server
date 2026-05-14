#!/usr/bin/env python3
# Validates a release-manifest TOML against scripts/workspace/release-manifest.schema.json.
# Hand-rolled (no jsonschema dep). Exits 0 on valid, 1 on first error.
#
# Usage: _manifest_validate.py <manifest.toml> [<schema.json>]
import json
import os
import re
import sys
import tomllib

REPO_ROOT_HINT = "scripts/workspace/release-manifest.schema.json"


def _err(msg: str) -> None:
    print(f"manifest::validate ERROR: {msg}", file=sys.stderr)


def _check(cond: bool, msg: str) -> None:
    if not cond:
        _err(msg)
        sys.exit(1)


def _load_schema(schema_path: str) -> dict:
    with open(schema_path, "rb") as fh:
        return json.load(fh)


def _load_toml(path: str) -> dict:
    with open(path, "rb") as fh:
        return tomllib.load(fh)


def _validate(data: dict, schema: dict) -> None:
    required = schema.get("required", [])
    for key in required:
        _check(key in data, f"missing required top-level key '{key}'")

    props = schema.get("properties", {})
    rr = data.get("release_ref", "")
    _check(
        re.match(props["release_ref"]["pattern"], rr) is not None,
        f"release_ref '{rr}' does not match {props['release_ref']['pattern']}",
    )

    siblings = data.get("sibling", [])
    _check(isinstance(siblings, list), "'sibling' must be an array of tables")
    _check(len(siblings) >= 1, "'sibling' must have at least one entry")

    sib_schema = props["sibling"]["items"]
    sib_required = sib_schema.get("required", [])
    sib_props = sib_schema.get("properties", {})

    seen_names = set()
    for idx, sib in enumerate(siblings):
        _check(isinstance(sib, dict), f"[[sibling]] #{idx} is not a table")
        for key in sib_required:
            _check(
                key in sib,
                f"[[sibling]] #{idx} missing required key '{key}' (have {sorted(sib.keys())})",
            )
        name = sib["name"]
        _check(name not in seen_names, f"duplicate sibling name '{name}'")
        seen_names.add(name)
        sha = sib["pinned_sha"]
        _check(
            re.match(sib_props["pinned_sha"]["pattern"], sha) is not None,
            f"sibling '{name}' pinned_sha '{sha}' is not a 40-char lowercase hex SHA",
        )
        for str_key in ("pinned_from_ref", "local_path"):
            val = sib.get(str_key, "")
            _check(
                isinstance(val, str) and len(val) >= 1,
                f"sibling '{name}' {str_key} must be a non-empty string",
            )


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: _manifest_validate.py <manifest.toml> [<schema.json>]", file=sys.stderr)
        return 64
    manifest_path = sys.argv[1]
    schema_path = sys.argv[2] if len(sys.argv) > 2 else REPO_ROOT_HINT
    if not os.path.isfile(manifest_path):
        _err(f"manifest not found: {manifest_path}")
        return 1
    if not os.path.isfile(schema_path):
        _err(f"schema not found: {schema_path}")
        return 1
    data = _load_toml(manifest_path)
    schema = _load_schema(schema_path)
    _validate(data, schema)
    return 0


if __name__ == "__main__":
    sys.exit(main())
