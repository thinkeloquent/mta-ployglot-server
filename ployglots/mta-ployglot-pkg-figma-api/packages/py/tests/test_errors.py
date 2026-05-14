from figma_api import (
    FigmaAuthError,
    FigmaError,
    FigmaNotFoundError,
    FigmaRateLimitError,
    FigmaServerError,
    map_http_error,
)
from figma_api._errors import FigmaErrorContext


def _ctx(status: int, *, retry_after: str | None = None, body: str = "") -> FigmaErrorContext:
    return FigmaErrorContext(
        method="GET", url="/v1/me", status=status, body=body, retry_after=retry_after
    )


def test_401_is_auth_error():
    err = map_http_error(_ctx(401))
    assert isinstance(err, FigmaAuthError)
    assert "GET /v1/me → 401" in str(err)


def test_403_is_auth_error_with_status():
    err = map_http_error(_ctx(403))
    assert isinstance(err, FigmaAuthError)
    assert err.status == 403


def test_404_is_notfound():
    err = map_http_error(_ctx(404))
    assert isinstance(err, FigmaNotFoundError)


def test_429_parses_retry_after():
    err = map_http_error(_ctx(429, retry_after="42"))
    assert isinstance(err, FigmaRateLimitError)
    assert err.retry_after_seconds == 42


def test_5xx_is_server_error():
    err = map_http_error(_ctx(503))
    assert isinstance(err, FigmaServerError)
    assert err.status == 503


def test_other_4xx_is_base_error():
    err = map_http_error(_ctx(418))
    assert isinstance(err, FigmaError)
    assert not isinstance(err, FigmaAuthError)


def test_body_snippet_truncated():
    err = map_http_error(_ctx(400, body="x" * 500))
    assert len(str(err)) < 400


def test_429_with_non_numeric_retry_after():
    err = map_http_error(_ctx(429, retry_after="not-a-number"))
    assert isinstance(err, FigmaRateLimitError)
    assert err.retry_after_seconds is None


def test_429_without_retry_after_header():
    err = map_http_error(_ctx(429))
    assert isinstance(err, FigmaRateLimitError)
    assert err.retry_after_seconds is None


def test_figma_transport_error_constructible():
    from figma_api import FigmaTransportError

    err = FigmaTransportError("network blew up")
    assert str(err) == "network blew up"
    assert isinstance(err, Exception)


def test_figma_config_error_is_figma_error():
    from figma_api import FigmaConfigError, FigmaError

    err = FigmaConfigError("bad config")
    assert isinstance(err, FigmaError)
