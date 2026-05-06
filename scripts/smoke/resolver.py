#!/usr/bin/env python3
"""Smoke: prove ResolverHandle resolves {{env.PORT}} against a synthetic env."""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "server" / "fastapi"))

os.environ.setdefault("PORT", "5200")

from config.lifecycles._env_resolve import EnvResolver  # noqa: E402
from config.lifecycles._runtime_template_resolver import ResolverHandle  # noqa: E402


async def main() -> None:
    handle = ResolverHandle(env_resolve=EnvResolver(config=None))
    result = await handle.resolve("{{env.PORT}}", {})
    print(f"port={result}")
    assert "5200" in str(result), f"unexpected: {result}"


asyncio.run(main())
