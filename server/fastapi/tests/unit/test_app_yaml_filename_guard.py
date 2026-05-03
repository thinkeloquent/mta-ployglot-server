"""Unit tests for the basename guard used by the dynamic app-yaml-file route."""

from __future__ import annotations

import pytest

from config.routes._app_yaml_filename_guard import assert_safe_basename


@pytest.mark.parametrize(
    "name",
    [
        "endpoint.dev.yaml",
        "base.yml",
        "feature_flags.yml",
        "database_schema.yaml",
        "llm_rag.yml",
        "vite.yaml",
        "server.dev.yaml",
        "api-release-date.yml",
        "security.yml",
        "a.yaml",
    ],
)
def test_accepts(name):
    assert assert_safe_basename(name) == name


@pytest.mark.parametrize(
    "name",
    [
        "",
        "../base.yml",
        "foo/bar.yaml",
        "foo\\bar.yaml",
        ".hidden.yaml",
        "no-extension",
        "trailing.dot.",
        "%2e%2e%2fbase.yml",
        "base.yml/../etc/passwd",
        "base.txt",
    ],
)
def test_rejects(name):
    with pytest.raises(ValueError):
        assert_safe_basename(name)
