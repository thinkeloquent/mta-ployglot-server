#!/usr/bin/env python3
"""F04 / story 02 — overwrite_from_context overlay against openai headers."""
from __future__ import annotations

import os

from app_yaml_from_context import apply_overwrites_from_context
from runtime_template_resolver import (
    ComputeRegistry, ComputeScope, MissingStrategy, create_resolver,
)
from _init import reset_and_init, run, stable


async def main():
    inst = await reset_and_init()

    reg = ComputeRegistry()
    reg.register("compute_localhost_test_case_001_token", lambda _c, _p=None: "token-001", ComputeScope.STARTUP)
    reg.register("compute_localhost_test_case_005_token", lambda _c, _p=None: "token-005", ComputeScope.STARTUP)
    reg.register("startup_tokens", lambda _c, _p=None: {"case_001": "stk-001", "case_005": "stk-005", "timestamp_iso": "2026-04-27T00:00:00Z"}, ComputeScope.STARTUP)
    reg.register("request_token_001", lambda _c, _p=None: "req-001", ComputeScope.REQUEST)
    reg.register("request_token_005", lambda _c, _p=None: "req-005", ComputeScope.REQUEST)
    reg.register("provider_api_keys", lambda _c, _p=None: {"gemini_openai": "k-gem", "openai": "k-oai", "anthropic": "k-ant", "openai_embeddings": "k-emb", "figma": "k-fig", "github": "k-gh", "jira": "k-jra", "confluence": "k-cnf", "saucelabs": "k-sl", "servicenow": "k-sn", "rally": "k-rly", "statsig": "k-stat", "sonar": "k-snr"}, ComputeScope.STARTUP)
    reg.register("test_case_002", lambda _c, _p=None: "Bearer k-jira", ComputeScope.REQUEST)
    reg.register("test_case_002_1", lambda _c, _p=None: "auth-aux", ComputeScope.REQUEST)
    reg.register("example_auto_loaded", lambda _c, _p=None: "auto-1", ComputeScope.STARTUP)

    resolver = create_resolver(registry=reg, missing_strategy=MissingStrategy.IGNORE)
    ctx = {
        "app": {"name": "demo", "version": "1.2.3"},
        "request": {"headers": {"x-request-id": "req-001"}},
        "env": dict(os.environ),
    }

    before_headers = inst.get_nested(["providers", "openai", "headers"])
    merged = await apply_overwrites_from_context(inst.get_all(), resolver=resolver, context=ctx)
    after_headers = merged["providers"]["openai"]["headers"]

    print(stable({
        "before_openai_headers": before_headers,
        "after_openai_headers": after_headers,
        "invariants": {
            "x_app_name_resolved": after_headers["X-App-Name"] == "demo",
            "x_app_version_resolved": after_headers["X-App-Version"] == "1.2.3",
            "x_computed_token_resolved": after_headers["X-Computed-Token"] == "token-001",
            "x_server_start_left_as_literal": after_headers["X-Server-Start"] == "{{fn:startup_tokens.timestamp_iso}}",
            "null_replaced": before_headers.get("X-App-Name") is None and after_headers["X-App-Name"] == "demo",
        },
        "sdk_note": "X-Server-Start uses composite-property syntax which COMPUTE_PATTERN regex doesn't accept; literal returned. Workaround: register a flat fn or extract programmatically.",
    }))


if __name__ == "__main__":
    run(main)
