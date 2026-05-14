"""SDKConfig + validation for the S3 client builder.

Mirrors the mjs twin at ``packages/mjs/src/config.ts``. Env-resolution
lives in the app-integration layer and passes a constructed
``SDKConfig`` into ``build_s3_client``.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict


class YamlStorageS3Config(TypedDict, total=False):
    bucket_name: str
    region_name: str
    endpoint_url: str
    access_key_id: str
    secret_access_key: str
    force_path_style: bool
    proxy_url: str | None
    verify_ssl: bool
    connect_timeout: int
    read_timeout: int
    max_retries: int


@dataclass
class SDKConfig:
    bucket_name: str | None = None
    region: str = "us-east-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    endpoint_url: str | None = None
    force_path_style: bool = False
    proxy_url: str | None = None
    connect_timeout: int = 10
    read_timeout: int = 60
    max_retries: int = 3
    verify_ssl: bool = False


def validate_config(cfg: SDKConfig, *, require_bucket: bool = True) -> list[str]:
    errs: list[str] = []
    if require_bucket and not cfg.bucket_name:
        errs.append("bucket_name is required")
    if cfg.endpoint_url and not (
        cfg.endpoint_url.startswith("http://") or cfg.endpoint_url.startswith("https://")
    ):
        errs.append(
            f"endpoint_url must start with http:// or https://: {cfg.endpoint_url}"
        )
    if cfg.proxy_url and not (
        cfg.proxy_url.startswith("http://") or cfg.proxy_url.startswith("https://")
    ):
        errs.append(
            f"proxy_url must start with http:// or https://: {cfg.proxy_url}"
        )
    return errs


def assert_valid_config(cfg: SDKConfig, *, require_bucket: bool = True) -> None:
    errs = validate_config(cfg, require_bucket=require_bucket)
    if errs:
        raise ValueError(f"Invalid S3 config: {'; '.join(errs)}")
