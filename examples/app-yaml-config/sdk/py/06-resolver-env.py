#!/usr/bin/env python3
"""F03 / story 02 — {{env.X}} + default-value syntax."""
from __future__ import annotations

import asyncio
import json
import os

from runtime_template_resolver import MissingStrategy, create_resolver


async def main():
    r = create_resolver(missing_strategy=MissingStrategy.IGNORE)
    out = {
        "home_set": "HOME" in os.environ,
        "default_when_unset": await r.resolve('{{env.NEVER_SET_BY_TEST | "default-here"}}', {"env": dict(os.environ)}),
        "default_numeric": await r.resolve('{{env.ALSO_NEVER_SET | "42"}}', {"env": dict(os.environ)}),
        "home_resolved": "<HOME>" if await r.resolve("{{env.HOME}}", {"env": dict(os.environ)}) else None,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
