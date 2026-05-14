"""Tests for the immutable mutator stubs."""

from __future__ import annotations

import asyncio
from collections import OrderedDict

import pytest

from app_yaml_config.core import AppYamlConfig
from app_yaml_config.errors import ImmutabilityError


@pytest.fixture(autouse=True)
def _reset_singleton():
    AppYamlConfig._reset_for_testing()
    yield
    AppYamlConfig._reset_for_testing()


def _init():
    return asyncio.run(
        AppYamlConfig.initialize(
            loaded=OrderedDict([("a.yml", {"x": 1, "providers": {"p": {"y": 2}}})])
        )
    )


@pytest.mark.parametrize("method,args", [
    ("set", ("k", "v")),
    ("update", ({"k": "v"},)),
    ("reset", ()),
    ("clear", ()),
])
def test_mutator_raises_immutability_error(method, args):
    inst = _init()
    before = inst.get_all()
    with pytest.raises(ImmutabilityError):
        getattr(inst, method)(*args)
    assert inst.get_all() == before


def test_immutability_error_preserves_message():
    err = ImmutabilityError("custom")
    assert str(err) == "custom"
    assert isinstance(err, Exception)
