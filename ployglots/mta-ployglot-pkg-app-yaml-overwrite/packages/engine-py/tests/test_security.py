import pytest

from runtime_template_resolver.errors import SecurityError
from runtime_template_resolver.security import Security


def test_validate_path_clean_returns_silently():
    Security.validate_path("a.b.c")
    Security.validate_path("foo")
    Security.validate_path("")


def test_validate_path_proto_throws():
    with pytest.raises(SecurityError):
        Security.validate_path("a.__proto__.x")


def test_validate_path_constructor_throws():
    with pytest.raises(SecurityError):
        Security.validate_path("constructor")


def test_validate_path_prototype_throws():
    with pytest.raises(SecurityError):
        Security.validate_path("foo.prototype.bar")
