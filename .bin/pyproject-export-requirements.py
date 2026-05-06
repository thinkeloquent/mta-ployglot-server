#!/usr/bin/env python3
"""
Export requirements.txt from pyproject.toml without using Poetry.

This script parses pyproject.toml and generates a requirements.txt file
compatible with pip. It handles both [tool.poetry.dependencies] and
[project.dependencies] formats.

Usage:
    python .bin/pyproject-export-requirements.py
    python .bin/pyproject-export-requirements.py --output requirements.txt
    python .bin/pyproject-export-requirements.py --dev  # Include dev dependencies
    python .bin/pyproject-export-requirements.py --all  # Include local packages as -e
    python .bin/pyproject-export-requirements.py --all --path-mode=custom --base-path=/app

Options:
    --output, -o    Output file path (default: requirements.txt)
    --dev           Include dev dependencies
    --all           Include local packages as editable installs
    --no-versions   Output package names only (no version constraints)
    --path-mode     How to format local package paths:
                    - relative (default): -e polyglot/server/py
                    - absolute: -e /full/path/polyglot/server/py
                    - custom: -e /app/polyglot/server/py (with --base-path)
    --base-path     Custom base path prefix (used with --path-mode=custom)
"""

import argparse
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

# Try tomllib (Python 3.11+) or fall back to tomli
try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        print("Error: tomllib (Python 3.11+) or tomli package required.")
        print("Install with: pip install tomli")
        sys.exit(1)


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent


def convert_poetry_version(version_spec: str) -> str:
    """
    Convert Poetry version specifier to pip-compatible format.

    Poetry uses:
        ^1.2.3  -> >=1.2.3,<2.0.0 (caret)
        ~1.2.3  -> >=1.2.3,<1.3.0 (tilde)
        >=1.2.3 -> >=1.2.3
        ==1.2.3 -> ==1.2.3
        *       -> (any version)
    """
    if not version_spec or version_spec == "*":
        return ""

    version_spec = version_spec.strip()

    # Already pip-compatible
    if version_spec.startswith((">=", "<=", "==", "!=", "<", ">")):
        return version_spec

    # Caret version (^1.2.3 -> >=1.2.3,<2.0.0)
    if version_spec.startswith("^"):
        version = version_spec[1:]
        parts = version.split(".")
        if len(parts) >= 1:
            major = int(parts[0])
            if major == 0:
                # ^0.x.y -> >=0.x.y,<0.(x+1).0
                if len(parts) >= 2:
                    minor = int(parts[1])
                    return f">={version},<0.{minor + 1}.0"
                return f">={version}"
            return f">={version},<{major + 1}.0.0"
        return f">={version}"

    # Tilde version (~1.2.3 -> >=1.2.3,<1.3.0)
    if version_spec.startswith("~"):
        version = version_spec[1:]
        parts = version.split(".")
        if len(parts) >= 2:
            major, minor = int(parts[0]), int(parts[1])
            return f">={version},<{major}.{minor + 1}.0"
        return f">={version}"

    # Assume exact version if no operator
    if re.match(r"^\d", version_spec):
        return f"=={version_spec}"

    return version_spec


def parse_poetry_dependencies(pyproject_data: dict, include_dev: bool = False) -> tuple[dict, list]:
    """
    Parse Poetry-style dependencies from pyproject.toml.

    Returns:
        Tuple of (pypi_packages dict, local_packages list)
    """
    poetry_config = pyproject_data.get("tool", {}).get("poetry", {})

    packages = {}
    local_packages = []

    # Main dependencies
    deps = poetry_config.get("dependencies", {})

    # Dev dependencies (Poetry 1.x style)
    if include_dev:
        dev_deps = poetry_config.get("dev-dependencies", {})
        deps = {**deps, **dev_deps}

        # Poetry 2.x style (group.dev.dependencies)
        groups = poetry_config.get("group", {})
        for group_name, group_config in groups.items():
            if group_name == "dev" or include_dev:
                group_deps = group_config.get("dependencies", {})
                deps = {**deps, **group_deps}

    for name, version_spec in deps.items():
        # Skip python version constraint
        if name.lower() == "python":
            continue

        # Handle complex dependency specs
        if isinstance(version_spec, dict):
            # Local path dependency
            if "path" in version_spec:
                local_packages.append((name, version_spec["path"]))
                continue

            # Git dependency
            if "git" in version_spec:
                git_url = version_spec["git"]
                branch = version_spec.get("branch", version_spec.get("tag", version_spec.get("rev", "")))
                if branch:
                    packages[name] = f"@ git+{git_url}@{branch}"
                else:
                    packages[name] = f"@ git+{git_url}"
                continue

            # URL dependency
            if "url" in version_spec:
                packages[name] = f"@ {version_spec['url']}"
                continue

            # Version with extras
            version = version_spec.get("version", "")
            extras = version_spec.get("extras", [])
            if extras:
                name = f"{name}[{','.join(extras)}]"
            version_spec = version

        # Convert version spec
        pip_version = convert_poetry_version(version_spec) if isinstance(version_spec, str) else ""
        packages[name] = pip_version

    return packages, local_packages


def parse_pep621_dependencies(pyproject_data: dict, include_dev: bool = False) -> tuple[dict, list]:
    """
    Parse PEP 621 style dependencies from pyproject.toml.

    Returns:
        Tuple of (pypi_packages dict, local_packages list)
    """
    project_config = pyproject_data.get("project", {})

    packages = {}
    local_packages = []

    # Main dependencies
    deps = project_config.get("dependencies", [])

    # Optional dependencies (often used for dev)
    if include_dev:
        optional_deps = project_config.get("optional-dependencies", {})
        for group_deps in optional_deps.values():
            deps = deps + group_deps

    for dep in deps:
        # Parse dependency string (e.g., "requests>=2.0.0" or "mypackage @ file:///path")
        if " @ " in dep:
            name, location = dep.split(" @ ", 1)
            name = name.strip()
            if location.startswith("file://"):
                local_packages.append((name, location.replace("file://", "")))
            else:
                packages[name] = f"@ {location}"
        else:
            # Parse name and version
            match = re.match(r"^([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)\s*(.*)$", dep)
            if match:
                name, version = match.groups()
                packages[name.strip()] = version.strip()

    return packages, local_packages


def parse_uv_dev_dependencies(pyproject_data: dict) -> dict:
    """Parse uv-style dev dependencies."""
    uv_config = pyproject_data.get("tool", {}).get("uv", {})
    dev_deps = uv_config.get("dev-dependencies", [])

    packages = {}
    for dep in dev_deps:
        # Skip comments
        if dep.strip().startswith("#"):
            continue

        # Parse dependency string
        match = re.match(r"^([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)\s*(.*)$", dep)
        if match:
            name, version = match.groups()
            packages[name.strip()] = version.strip()

    return packages


def generate_requirements(
    packages: dict,
    local_packages: list,
    output_path: Path,
    include_local: bool = False,
    no_versions: bool = False,
    root: Path = None,
    path_mode: str = "relative",
    base_path: str = None
) -> None:
    """
    Generate requirements.txt file.

    Args:
        packages: Dict of package names to version specs
        local_packages: List of (name, path) tuples for local packages
        output_path: Where to write requirements.txt
        include_local: Whether to include local packages
        no_versions: Output package names only
        root: Project root path
        path_mode: How to format local package paths:
            - "relative": Use relative paths (default, e.g., polyglot/server/py)
            - "absolute": Use absolute paths (e.g., /Users/.../polyglot/server/py)
            - "custom": Use base_path prefix (e.g., /app/polyglot/server/py)
        base_path: Custom base path prefix (used when path_mode="custom")
    """
    lines = [
        "# Auto-generated requirements.txt - DO NOT EDIT MANUALLY",
        f"# Generated from pyproject.toml by .bin/pyproject-export-requirements.py",
        f"# Generated at: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}",
        "#",
        "# Install with: pip install -r requirements.txt",
        "",
    ]

    # Sort packages alphabetically
    for name in sorted(packages.keys(), key=str.lower):
        version = packages[name]
        if no_versions:
            lines.append(name.split("[")[0])  # Remove extras for name-only output
        elif version.startswith("@"):
            lines.append(f"{name} {version}")
        elif version:
            lines.append(f"{name}{version}")
        else:
            lines.append(name)

    # Add local packages as editable installs
    if include_local and local_packages:
        lines.append("")
        lines.append("# Local packages (editable installs)")
        for name, path in sorted(local_packages, key=lambda x: x[0].lower()):
            if path_mode == "absolute" and root:
                # Absolute path
                full_path = root / path
                lines.append(f"-e {full_path}")
            elif path_mode == "custom" and base_path:
                # Custom base path (e.g., /app for Docker)
                custom_path = f"{base_path.rstrip('/')}/{path}"
                lines.append(f"-e {custom_path}")
            else:
                # Relative path (default)
                lines.append(f"-e {path}")

    # Add trailing newline
    lines.append("")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"Generated {output_path}")
    print(f"  - PyPI packages: {len(packages)}")
    if include_local:
        print(f"  - Local packages: {len(local_packages)}")


def main():
    parser = argparse.ArgumentParser(
        description="Export requirements.txt from pyproject.toml without Poetry"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Output file path (default: requirements.txt)"
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Include dev dependencies"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Include local packages as editable installs"
    )
    parser.add_argument(
        "--no-versions",
        action="store_true",
        help="Output package names only (no version constraints)"
    )
    parser.add_argument(
        "--pyproject",
        type=Path,
        default=None,
        help="Path to pyproject.toml (default: project root)"
    )
    parser.add_argument(
        "--path-mode",
        choices=["relative", "absolute", "custom"],
        default="relative",
        help="How to format local package paths (default: relative)"
    )
    parser.add_argument(
        "--base-path",
        type=str,
        default=None,
        help="Custom base path prefix for local packages (used with --path-mode=custom, e.g., /app)"
    )

    args = parser.parse_args()

    root = get_project_root()
    pyproject_path = args.pyproject or root / "pyproject.toml"
    output_path = args.output or root / "requirements.txt"

    if not pyproject_path.exists():
        print(f"Error: pyproject.toml not found at {pyproject_path}", file=sys.stderr)
        sys.exit(1)

    # Parse pyproject.toml
    with open(pyproject_path, "rb") as f:
        pyproject_data = tomllib.load(f)

    packages = {}
    local_packages = []

    # Try Poetry format first
    if "tool" in pyproject_data and "poetry" in pyproject_data["tool"]:
        print("Parsing Poetry dependencies...")
        packages, local_packages = parse_poetry_dependencies(pyproject_data, include_dev=args.dev)

    # Try PEP 621 format
    elif "project" in pyproject_data and "dependencies" in pyproject_data.get("project", {}):
        print("Parsing PEP 621 dependencies...")
        packages, local_packages = parse_pep621_dependencies(pyproject_data, include_dev=args.dev)

    # Fallback: try uv format for dev dependencies
    if args.dev and "tool" in pyproject_data and "uv" in pyproject_data["tool"]:
        print("Adding uv dev dependencies...")
        uv_deps = parse_uv_dev_dependencies(pyproject_data)
        packages.update(uv_deps)

    if not packages and not local_packages:
        print("Warning: No dependencies found in pyproject.toml", file=sys.stderr)

    # Generate requirements.txt
    generate_requirements(
        packages,
        local_packages,
        output_path,
        include_local=args.all,
        no_versions=args.no_versions,
        root=root,
        path_mode=args.path_mode,
        base_path=args.base_path
    )

    print(f"\nInstall with: pip install -r {output_path.name}")


if __name__ == "__main__":
    main()
