#!/usr/bin/env python3
"""F03 / story 04 — three MissingStrategy modes."""
from __future__ import annotations

import asyncio
import json

from runtime_template_resolver import (
    ComputeFunctionError, MissingStrategy, create_resolver,
)


async def main():
    out = {}

    try:
        r = create_resolver(missing_strategy=MissingStrategy.ERROR)
        await r.resolve("{{env.NOT_SET}}", {"env": {}})
        out["ERROR"] = "<unexpected: did not raise>"
    except ComputeFunctionError:
        out["ERROR"] = "<caught: ComputeFunctionError>"
    except Exception as e:
        out["ERROR"] = f"<caught: {type(e).__name__}>"

    r = create_resolver(missing_strategy=MissingStrategy.IGNORE)
    out["IGNORE"] = await r.resolve("{{env.NOT_SET}}", {"env": {}})

    r = create_resolver(missing_strategy=MissingStrategy.DEFAULT)
    out["DEFAULT"] = await r.resolve("{{env.NOT_SET}}", {"env": {}})

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
