from dataclasses import replace

import pytest

from polyglot_aws_s3 import SDKConfig, assert_valid_config, validate_config


def _base_valid() -> SDKConfig:
    return SDKConfig(
        bucket_name="my-bucket",
        region="us-east-1",
        force_path_style=False,
        connect_timeout=10,
        read_timeout=60,
        max_retries=3,
        verify_ssl=False,
    )


class TestDefaults:
    def test_dataclass_defaults_match_spec(self) -> None:
        cfg = SDKConfig()
        assert cfg.region == "us-east-1"
        assert cfg.force_path_style is False
        assert cfg.verify_ssl is False
        assert cfg.connect_timeout == 10
        assert cfg.read_timeout == 60
        assert cfg.max_retries == 3
        assert cfg.bucket_name is None
        assert cfg.endpoint_url is None
        assert cfg.proxy_url is None
        assert cfg.aws_access_key_id is None
        assert cfg.aws_secret_access_key is None


class TestValidateConfig:
    def test_accepts_fully_populated_config(self) -> None:
        assert validate_config(_base_valid()) == []

    def test_flags_missing_bucket_name(self) -> None:
        cfg = replace(_base_valid(), bucket_name=None)
        errs = validate_config(cfg)
        assert "bucket_name is required" in errs

    def test_does_not_flag_missing_bucket_when_not_required(self) -> None:
        cfg = replace(_base_valid(), bucket_name=None)
        assert validate_config(cfg, require_bucket=False) == []

    def test_flags_invalid_endpoint_scheme(self) -> None:
        cfg = replace(_base_valid(), endpoint_url="bad://x")
        errs = validate_config(cfg)
        assert errs == ["endpoint_url must start with http:// or https://: bad://x"]

    @pytest.mark.parametrize(
        "endpoint",
        ["http://localstack:4566", "https://s3.example.com"],
    )
    def test_accepts_valid_endpoint_schemes(self, endpoint: str) -> None:
        cfg = replace(_base_valid(), endpoint_url=endpoint)
        assert validate_config(cfg) == []

    def test_flags_invalid_proxy_scheme(self) -> None:
        cfg = replace(_base_valid(), proxy_url="socks5://h:1080")
        errs = validate_config(cfg)
        assert errs == ["proxy_url must start with http:// or https://: socks5://h:1080"]

    def test_collects_multiple_errors(self) -> None:
        cfg = replace(
            _base_valid(),
            bucket_name=None,
            endpoint_url="ftp://x",
            proxy_url="bad://y",
        )
        errs = validate_config(cfg)
        assert len(errs) == 3


class TestAssertValidConfig:
    def test_returns_none_for_valid_config(self) -> None:
        assert assert_valid_config(_base_valid()) is None

    def test_raises_value_error_for_invalid(self) -> None:
        cfg = replace(_base_valid(), endpoint_url="bad://x")
        with pytest.raises(ValueError, match="endpoint_url must start with http"):
            assert_valid_config(cfg)

    def test_prefixes_message_with_invalid_s3_config(self) -> None:
        cfg = replace(_base_valid(), bucket_name=None)
        with pytest.raises(ValueError, match=r"^Invalid S3 config: "):
            assert_valid_config(cfg)
