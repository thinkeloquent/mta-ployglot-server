#!/usr/bin/env python3
"""F03 / story 04 — parse_default: string / None / numeric coercion."""
from __future__ import annotations

import asyncio
import json
import os

from runtime_template_resolver import MissingStrategy, create_resolver


async def main():
    r = create_resolver(missing_strategy=MissingStrategy.IGNORE)
    out = {
        "env_default_string": await r.resolve('{{env.NEVER_SET | "fallback"}}', {"env": dict(os.environ)}),
        "fn_default_null": await r.resolve("{{fn:nope | null}}", {}),
        "app_default_numeric": await r.resolve('{{app.x | "5000"}}', {}),
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
