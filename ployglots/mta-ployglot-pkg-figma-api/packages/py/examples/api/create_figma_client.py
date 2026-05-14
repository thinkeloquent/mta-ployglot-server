"""API-shape example: the minimum viable constructor call for every
supported mode. No network I/O — for copy/paste reference only.

Run: python -m examples.api.create_figma_client
"""

from __future__ import annotations

import os
import sys

from fetch_http_client import APIKeyAuth, AsyncClient, RetryConfig

from figma_api import FigmaClient, fetch_client_from_polyglot


def main() -> None:
    token = os.environ.get("FIGMA_PASS", "figd_token_goes_here")

    # Mode A — default transport, auto-detected proxy.
    _a = FigmaClient(token=token, proxy={})

    # Mode B — default transport, explicit proxy host.
    _b = FigmaClient(token=token, proxy={"host": "http://proxy.corp:3128"})

    # Mode C — default transport, explicit proxy host + auth.
    _c = FigmaClient(
        token=token,
        proxy={"host": "http://proxy.corp:3128", "user": "u", "pass": "p"},
    )

    # Mode D — BYO outer AsyncClient (custom retry).
    outer = AsyncClient(
        base_url="https://api.figma.com",
        auth=APIKeyAuth(token, "X-Figma-Token"),
        retry=RetryConfig(max_attempts=5),
    )
    _d = FigmaClient(token=token, fetch_client=fetch_client_from_polyglot(outer))

    sys.stdout.write("Constructed 4 FigmaClients: A B C D\n")


if __name__ == "__main__":
    main()
