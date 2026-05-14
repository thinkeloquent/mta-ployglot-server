"""Integration tests — hit the real Figma REST API.

Gated by the ``FIGMA_PASS`` env var: when unset, the whole suite
skips rather than failing CI. Optionally reads:

    FIGMA_HOST     override API host (default https://api.figma.com)
    FIGMA_USER     placeholder (Figma is token-only)
    FIGMA_FILE_KEY optional file key for the file-read smoke
    HTTPS_PROXY / HTTP_PROXY / HTTP_PROXY_USER / HTTP_PROXY_PASS
"""

import os

import pytest

from figma_api import FigmaAuthError, FigmaClient

_HAS_TOKEN = bool(os.environ.get("FIGMA_PASS"))
_FILE_KEY = os.environ.get("FIGMA_FILE_KEY")


@pytest.mark.skipif(not _HAS_TOKEN, reason="FIGMA_PASS not set")
@pytest.mark.asyncio
async def test_get_me_returns_handle():
    async with FigmaClient(proxy={}) as client:
        me = await client.me.get()
        assert isinstance(me.get("id"), str)
        assert isinstance(me.get("handle"), str)
        assert len(me["handle"]) > 0


@pytest.mark.skipif(not _HAS_TOKEN, reason="FIGMA_PASS not set")
@pytest.mark.asyncio
async def test_bogus_token_rejects_with_auth_error():
    async with FigmaClient(token="figd_invalid_token_12345", proxy={}) as client:
        with pytest.raises(FigmaAuthError):
            await client.me.get()


@pytest.mark.skipif(not (_HAS_TOKEN and _FILE_KEY), reason="FIGMA_PASS or FIGMA_FILE_KEY not set")
@pytest.mark.asyncio
async def test_get_file_document():
    async with FigmaClient(proxy={}) as client:
        file = await client.files.get(_FILE_KEY, depth=1)
        assert isinstance(file.get("name"), str)
        assert isinstance(file.get("lastModified"), str)
