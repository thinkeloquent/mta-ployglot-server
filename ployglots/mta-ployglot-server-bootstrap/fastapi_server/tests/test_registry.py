import pytest

from fastapi_server.bootstrap.registry.registry import Addon, Registry
from fastapi_server.bootstrap.registry.ctx import create_context, StdoutLogger
from fastapi_server.bootstrap.contract import (
    HookCollector,
    ResolvedBootstrapConfig,
    ResolvedPaths,
    create_loader_report,
)


def _cfg():
    return ResolvedBootstrapConfig(
        title="t", port=1, host="h", paths=ResolvedPaths(), logger={}, initial_state={}
    )


class _FakeAdapter:
    name = "fake"

    def create_server(self, _cfg):
        return object()


def test_priority_then_insertion_order():
    reg = Registry()
    reg.register(Addon(name="b", priority=20, run=lambda s, c, x: create_loader_report("b")))
    reg.register(Addon(name="a", priority=10, run=lambda s, c, x: create_loader_report("a")))
    reg.register(Addon(name="c", priority=20, run=lambda s, c, x: create_loader_report("c")))
    assert [a.name for a in reg.list()] == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_run_all_isolates_failures():
    def boom(*_):
        raise RuntimeError("kaboom")

    reg = Registry()
    reg.register(Addon(name="ok", priority=10, run=lambda s, c, x: create_loader_report("ok")))
    reg.register(Addon(name="boom", priority=20, run=boom))
    reg.register(Addon(name="ok2", priority=30, run=lambda s, c, x: create_loader_report("ok2")))

    cfg = _cfg()
    hooks = HookCollector()
    ctx = create_context(_FakeAdapter(), cfg, hooks, StdoutLogger())
    reports = await reg.run_all(object(), cfg, ctx)
    assert reports["ok"].errors == []
    assert len(reports["boom"].errors) == 1
    assert "kaboom" in reports["boom"].errors[0].error
    assert reports["ok2"].errors == []
