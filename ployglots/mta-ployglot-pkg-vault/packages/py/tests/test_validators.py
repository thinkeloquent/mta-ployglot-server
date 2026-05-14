from polyglot_vault_file.validators import EnvKeyNotFoundError


def test_has_key_attribute():
    e = EnvKeyNotFoundError("FOO")
    assert e.key == "FOO"


def test_message_matches_canonical_format():
    assert str(EnvKeyNotFoundError("FOO")) == "Environment variable 'FOO' not found"


def test_is_exception_subclass():
    assert issubclass(EnvKeyNotFoundError, Exception)
