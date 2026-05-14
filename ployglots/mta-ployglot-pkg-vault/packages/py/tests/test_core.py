from pathlib import Path

import pytest

from polyglot_vault_file.core import (
    from_json,
    normalize_version,
    parse_env_file,
    to_json,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_normalize_version_pads_short():
    assert normalize_version("1.0") == "1.0.0"


def test_normalize_version_truncates_long():
    assert normalize_version("1.2.3.4.5") == "1.2.3"


def test_to_json_from_json_round_trip():
    raw = (FIXTURES / "vault.valid.json").read_text()
    vf = from_json(raw)
    serialised = to_json(vf)
    round = from_json(serialised)
    assert round.header.version == "1.0.0"
    assert round.secrets["SHARED"] == "file-value"


def test_from_json_empty_raises():
    with pytest.raises(ValueError):
        from_json("")


def test_parse_env_file_quoted_comments_blank():
    parsed = parse_env_file(str(FIXTURES / ".env.mixed"))
    assert parsed["SHARED"] == "file-value"
    assert parsed["FILE_ONLY"] == "only-in-file"
    assert parsed["QUOTED"] == "wrapped in double quotes"
    assert parsed["SINGLE_QUOTED"] == "wrapped in single quotes"


def test_parse_env_file_missing_returns_empty():
    assert parse_env_file("/tmp/definitely-not-there-xyz.env") == {}
