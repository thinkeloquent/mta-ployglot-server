"""Tests for the structured logger."""

from __future__ import annotations

import io
import json

import pytest

from fetch_http_client import LogLevel, create_logger
from fetch_http_client._logger import Logger


def _sink() -> io.StringIO:
    return io.StringIO()


class TestLogger:
    def test_info_emits(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.INFO, format="json", _out=out)
        log.info("hello", user="alice")
        rec = json.loads(out.getvalue().strip())
        assert rec["msg"] == "hello"
        assert rec["user"] == "alice"
        assert rec["level"] == "INFO"

    def test_level_filtering(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.WARN, format="json", _out=out)
        log.info("hidden")
        assert out.getvalue() == ""
        log.warn("shown")
        assert "shown" in out.getvalue()

    def test_pretty_format(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.INFO, format="pretty", _out=out)
        log.info("hello")
        assert "[INFO] x: hello" in out.getvalue()

    def test_redaction(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.INFO, format="json", _out=out)
        log.info(
            "req",
            headers={"authorization": "Bearer abc", "accept": "application/json"},
        )
        rec = json.loads(out.getvalue().strip())
        assert rec["headers"]["authorization"] == "[REDACTED]"
        assert rec["headers"]["accept"] == "application/json"

    def test_child_carries_context(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.INFO, format="json", _out=out)
        kid = log.child(request_id="r1")
        kid.info("msg")
        rec = json.loads(out.getvalue().strip())
        assert rec["request_id"] == "r1"

    def test_create_logger_factory(self) -> None:
        log = create_logger("tests.logger", svc="x")
        assert log.name == "tests.logger"
        assert log.context == {"svc": "x"}

    def test_all_levels_emit(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.TRACE, format="json", _out=out)
        log.trace("t-msg")
        log.debug("d-msg")
        log.info("i-msg")
        log.warn("w-msg")
        log.warning("w2-msg")
        log.error("e-msg")
        lines = out.getvalue().strip().splitlines()
        levels = [json.loads(line)["level"] for line in lines]
        assert levels == ["TRACE", "DEBUG", "INFO", "WARN", "WARN", "ERROR"]

    def test_with_level_returns_new_instance(self) -> None:
        log = Logger(name="x", level=LogLevel.INFO, format="json", _out=_sink())
        clone = log.with_level(LogLevel.ERROR)
        assert clone is not log
        assert clone.level == LogLevel.ERROR
        assert log.level == LogLevel.INFO

    def test_with_level_preserves_context(self) -> None:
        log = Logger(
            name="x",
            level=LogLevel.INFO,
            format="json",
            context={"svc": "api"},
            _out=_sink(),
        )
        clone = log.with_level(LogLevel.DEBUG)
        assert clone.context == {"svc": "api"}

    def test_redact_in_list(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.INFO, format="json", _out=out)
        log.info("req", entries=[{"authorization": "bearer-xxx"}, {"accept": "*/*"}])
        rec = json.loads(out.getvalue().strip())
        assert rec["entries"][0]["authorization"] == "[REDACTED]"
        assert rec["entries"][1]["accept"] == "*/*"

    def test_default_out_is_stderr(self) -> None:
        import sys

        log = Logger(name="x")
        assert log._out is sys.stderr

    def test_post_init_respects_provided_out(self) -> None:
        sink = _sink()
        log = Logger(name="x", _out=sink)
        assert log._out is sink

    def test_silent_level_drops_everything(self) -> None:
        out = _sink()
        log = Logger(name="x", level=LogLevel.SILENT, format="json", _out=out)
        log.error("dropped")
        assert out.getvalue() == ""

    def test_warning_alias(self) -> None:
        # `warning` is a class attribute pointing at `warn`.
        assert Logger.warning is Logger.warn


class TestLoggerEnv:
    def test_env_level_known(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        log = Logger(name="x", _out=_sink())
        assert log.level == LogLevel.DEBUG

    def test_env_level_unknown_falls_back(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LOG_LEVEL", "CHATTER")
        log = Logger(name="x", _out=_sink())
        assert log.level == LogLevel.INFO

    def test_env_format_json(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LOG_FORMAT", "json")
        log = Logger(name="x", _out=_sink())
        assert log.format == "json"

    def test_env_format_pretty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LOG_FORMAT", "pretty")
        log = Logger(name="x", _out=_sink())
        assert log.format == "pretty"

    def test_env_format_production_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("LOG_FORMAT", raising=False)
        monkeypatch.setenv("PYTHON_ENV", "production")
        log = Logger(name="x", _out=_sink())
        assert log.format == "json"

    def test_env_format_development_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("LOG_FORMAT", raising=False)
        monkeypatch.setenv("PYTHON_ENV", "development")
        log = Logger(name="x", _out=_sink())
        assert log.format == "pretty"

    def test_env_format_invalid_falls_back_to_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Invalid LOG_FORMAT → treated as if unset → consult PYTHON_ENV.
        monkeypatch.setenv("LOG_FORMAT", "xml")
        monkeypatch.setenv("PYTHON_ENV", "production")
        log = Logger(name="x", _out=_sink())
        assert log.format == "json"


class TestLoggerResilience:
    def test_emit_swallows_flush_failure(self) -> None:
        class BrokenSink:
            def __init__(self) -> None:
                self.written: list[str] = []

            def write(self, s: str) -> None:
                self.written.append(s)

            def flush(self) -> None:
                raise OSError("sink broken")

        sink = BrokenSink()
        log = Logger(name="x", level=LogLevel.INFO, format="json", _out=sink)
        log.info("still delivered")
        assert any("still delivered" in line for line in sink.written)
