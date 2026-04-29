"""02_provider_api_keys — STARTUP. Composite map for {{fn:provider_api_keys.<provider>}}."""
from __future__ import annotations
import os


def _from_env(name: str) -> str:
    return os.environ.get(name, f"(unset:{name})")


def compute(_ctx, _path=None):
    return {
        "gemini_openai": _from_env("GEMINI_API_KEY"),
        "openai": _from_env("OPENAI_API_KEY"),
        "openai_embeddings": _from_env("OPENAI_API_KEY"),
        "anthropic": _from_env("ANTHROPIC_API_KEY"),
        "figma": _from_env("FIGMA_API_TOKEN"),
        "github": _from_env("GITHUB_API_TOKEN"),
        "jira": _from_env("JIRA_API_TOKEN"),
        "confluence": _from_env("CONFLUENCE_API_TOKEN"),
        "saucelabs": _from_env("SAUCE_ACCESS_KEY"),
        "servicenow": _from_env("SERVICENOW_PASSWORD"),
        "rally": _from_env("RALLY_API_KEY"),
        "statsig": _from_env("STATSIG_API_KEY"),
        "sonar": _from_env("SONAR_TOKEN"),
    }


scope = "STARTUP"
