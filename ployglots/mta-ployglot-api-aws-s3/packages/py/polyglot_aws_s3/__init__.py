"""Polyglot AWS S3 HTTPS client builder — Python twin."""
from .client import build_s3_client
from .config import (
    SDKConfig,
    YamlStorageS3Config,
    assert_valid_config,
    validate_config,
)

__version__ = "0.1.0"

__all__ = [
    "SDKConfig",
    "YamlStorageS3Config",
    "assert_valid_config",
    "build_s3_client",
    "validate_config",
]
