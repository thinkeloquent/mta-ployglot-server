"""Parity test: fastify_server/contracts must be byte-identical to fastapi_server/contracts."""

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FASTIFY_DIR = ROOT / "fastify_server" / "contracts"
FASTAPI_DIR = ROOT / "fastapi_server" / "contracts"
SCHEMA_NAMES = ("bootstrap.schema.json", "loader.schema.json", "hooks.schema.json")


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def test_schemas_exist_in_both_packages():
    for name in SCHEMA_NAMES:
        assert (FASTIFY_DIR / name).is_file(), f"missing: {FASTIFY_DIR/name}"
        assert (FASTAPI_DIR / name).is_file(), f"missing: {FASTAPI_DIR/name}"


def test_schemas_byte_identical_across_packages():
    for name in SCHEMA_NAMES:
        a = _sha(FASTIFY_DIR / name)
        b = _sha(FASTAPI_DIR / name)
        assert a == b, (
            f"Schema drift: {name}\n"
            f"  fastify_server/contracts/{name} sha256={a}\n"
            f"  fastapi_server/contracts/{name} sha256={b}\n"
            f"Fix: copy one side to the other and commit together."
        )
