"""Async S3 client builder — Python twin of mjs client.ts.

Uses aiobotocore + botocore.Config to plumb proxy URL, timeouts,
retry count, TLS verification, and path-style addressing into the
vendor SDK's request path.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import aiobotocore.session
from botocore.config import Config as BotoConfig

from .config import SDKConfig, assert_valid_config


@asynccontextmanager
async def build_s3_client(config: SDKConfig) -> AsyncIterator[Any]:
    """Yield a live aiobotocore S3 client honouring ``config``.

    Mirrors the mjs ``buildS3Client`` contract.
    """
    assert_valid_config(config)

    addressing = "path" if (config.force_path_style or config.endpoint_url) else "virtual"

    proxies: dict[str, str] | None = None
    if config.proxy_url:
        proxies = {"http": config.proxy_url, "https": config.proxy_url}

    boto_config = BotoConfig(
        s3={"addressing_style": addressing},
        connect_timeout=config.connect_timeout,
        read_timeout=config.read_timeout,
        retries={"max_attempts": config.max_retries},
        proxies=proxies,
    )

    create_kwargs: dict[str, Any] = {
        "region_name": config.region,
        "config": boto_config,
        "verify": config.verify_ssl,
    }
    if config.endpoint_url:
        create_kwargs["endpoint_url"] = config.endpoint_url
    if config.aws_access_key_id and config.aws_secret_access_key:
        create_kwargs["aws_access_key_id"] = config.aws_access_key_id
        create_kwargs["aws_secret_access_key"] = config.aws_secret_access_key

    session = aiobotocore.session.get_session()
    async with session.create_client("s3", **create_kwargs) as client:
        yield client
