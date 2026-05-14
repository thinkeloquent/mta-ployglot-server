import pytest

from fastapi_server.bootstrap.contract import (
    BootstrapConfigError,
    create_loader_report,
    merge_config,
    resolve_paths,
    sort_by_numeric_prefix,
    validate_bootstrap_config,
)


def test_merge_paths_core_first_absolute():
    merged = merge_config(
        {"paths": {"environment": "core/env"}},
        {"paths": {"environment": ["user/env1", "user/env2"]}},
        "/tmp/base",
    )
    assert merged.paths.environment == [
        "/tmp/base/core/env",
        "/tmp/base/user/env1",
        "/tmp/base/user/env2",
    ]
    assert merged.port == 3000
    assert merged.host == "0.0.0.0"
    assert merged.title == "polyglot-server"


def test_resolve_paths_defaults_empty():
    r = resolve_paths(None, "/tmp")
    assert r.environment == []
    assert r.lifecycles == []
    assert r.routes == []
    assert r.apps == []


def test_validate_rejects_bad_port():
    with pytest.raises(BootstrapConfigError):
        validate_bootstrap_config({"port": 99999})
    with pytest.raises(BootstrapConfigError):
        validate_bootstrap_config({"port": -1})
    with pytest.raises(BootstrapConfigError):
        validate_bootstrap_config({"port": "x"})
    with pytest.raises(BootstrapConfigError):
        validate_bootstrap_config({"paths": {"weird": "x"}})


def test_loader_report_canonical_shape():
    r = create_loader_report("env")
    assert r.name == "env"
    assert r.discovered == 0
    assert r.errors == []


def test_sort_by_numeric_prefix():
    result = sort_by_numeric_prefix(["/a/10_foo", "/a/bar", "/a/01_baz"])
    assert result == ["/a/01_baz", "/a/10_foo", "/a/bar"]
