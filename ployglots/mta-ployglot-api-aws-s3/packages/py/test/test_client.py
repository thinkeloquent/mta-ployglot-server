from dataclasses import replace

import pytest

from polyglot_aws_s3 import SDKConfig, build_s3_client


@pytest.fixture(autouse=True)
def _fake_aws_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    """Satisfy botocore's credential resolution without touching IMDS."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")


def _base_valid() -> SDKConfig:
    return SDKConfig(
        bucket_name="b",
        region="us-east-1",
        endpoint_url="http://localhost:4566",
    )


class TestAddressingStyle:
    @pytest.mark.asyncio
    async def test_path_when_endpoint_url_set(self) -> None:
        async with build_s3_client(_base_valid()) as client:
            assert client.meta.config.s3["addressing_style"] == "path"

    @pytest.mark.asyncio
    async def test_path_when_force_path_style_true(self) -> None:
        cfg = replace(_base_valid(), endpoint_url=None, force_path_style=True)
        async with build_s3_client(cfg) as client:
            assert client.meta.config.s3["addressing_style"] == "path"

    @pytest.mark.asyncio
    async def test_virtual_when_neither(self) -> None:
        cfg = replace(_base_valid(), endpoint_url=None, force_path_style=False)
        async with build_s3_client(cfg) as client:
            assert client.meta.config.s3["addressing_style"] == "virtual"


class TestProxies:
    @pytest.mark.asyncio
    async def test_proxies_set_when_proxy_url_given(self) -> None:
        cfg = replace(_base_valid(), proxy_url="http://proxy.local:8080")
        async with build_s3_client(cfg) as client:
            assert client.meta.config.proxies == {
                "http": "http://proxy.local:8080",
                "https": "http://proxy.local:8080",
            }

    @pytest.mark.asyncio
    async def test_proxies_none_when_absent(self) -> None:
        async with build_s3_client(_base_valid()) as client:
            assert client.meta.config.proxies is None


class TestTimeoutsAndRetries:
    @pytest.mark.asyncio
    async def test_retries_flow_into_boto_config(self) -> None:
        cfg = replace(_base_valid(), max_retries=7)
        async with build_s3_client(cfg) as client:
            retries = client.meta.config.retries
            # botocore stores either `max_attempts` (raw) or
            # `total_max_attempts` (normalized = 1 + max_attempts) depending
            # on when the client resolves the config.
            observed = retries.get("max_attempts") or (retries["total_max_attempts"] - 1)
            assert observed == 7

    @pytest.mark.asyncio
    async def test_timeouts_flow_into_boto_config(self) -> None:
        cfg = replace(_base_valid(), connect_timeout=5, read_timeout=42)
        async with build_s3_client(cfg) as client:
            assert client.meta.config.connect_timeout == 5
            assert client.meta.config.read_timeout == 42


class TestInvalidConfig:
    @pytest.mark.asyncio
    async def test_missing_bucket_raises(self) -> None:
        cfg = SDKConfig(bucket_name=None)
        with pytest.raises(ValueError, match="bucket_name"):
            async with build_s3_client(cfg):
                pass

    @pytest.mark.asyncio
    async def test_invalid_endpoint_scheme_raises(self) -> None:
        cfg = replace(_base_valid(), endpoint_url="bad://x")
        with pytest.raises(ValueError, match="endpoint_url"):
            async with build_s3_client(cfg):
                pass


class TestRegionAndEndpoint:
    @pytest.mark.asyncio
    async def test_region_flows_through(self) -> None:
        cfg = replace(_base_valid(), region="eu-west-1")
        async with build_s3_client(cfg) as client:
            assert client.meta.region_name == "eu-west-1"

    @pytest.mark.asyncio
    async def test_endpoint_url_flows_through(self) -> None:
        async with build_s3_client(_base_valid()) as client:
            assert "localhost:4566" in client.meta.endpoint_url
