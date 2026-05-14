import re

from polyglot_vault_file.domain import VaultHeader


def test_created_at_millisecond_precision() -> None:
    h = VaultHeader()
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$", h.created_at)
