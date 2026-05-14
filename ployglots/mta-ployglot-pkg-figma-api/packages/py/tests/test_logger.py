import io
import json

from figma_api import create_logger, mask_token


def test_mask_short_token():
    assert mask_token("abc") == "***"
    assert mask_token("") == "<empty>"
    assert mask_token(None) == "<empty>"


def test_mask_long_token():
    masked = mask_token("figd_1234567890abcdef")
    assert masked.startswith("figd")
    assert masked.endswith("cdef")
    assert "…" in masked


def test_logger_level_filter():
    stream = io.StringIO()
    log = create_logger(level="warn", stream=stream)
    log.info("ignored")
    log.warn("kept", a=1)
    lines = [line for line in stream.getvalue().splitlines() if line]
    assert len(lines) == 1
    parsed = json.loads(lines[0])
    assert parsed["level"] == "warn"
    assert parsed["msg"] == "kept"
    assert parsed["a"] == 1


def test_set_level_switches_threshold():
    stream = io.StringIO()
    log = create_logger(level="silent", stream=stream)
    log.error("suppressed")
    assert stream.getvalue() == ""
    log.set_level("error")
    log.error("emitted")
    assert stream.getvalue().count("\n") == 1


def test_all_five_level_methods():
    stream = io.StringIO()
    log = create_logger(level="trace", stream=stream)
    log.trace("t")
    log.debug("d")
    log.info("i")
    log.warn("w")
    log.error("e")
    lines = [line for line in stream.getvalue().splitlines() if line]
    assert [json.loads(line)["level"] for line in lines] == [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
    ]


def test_logger_falls_back_to_env_level(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "warn")
    stream = io.StringIO()
    log = create_logger(stream=stream)
    log.info("ignored")
    log.warn("kept")
    lines = [line for line in stream.getvalue().splitlines() if line]
    assert len(lines) == 1


def test_logger_defaults_to_info_when_no_env(monkeypatch):
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    stream = io.StringIO()
    log = create_logger(stream=stream)
    log.debug("ignored")
    log.info("kept")
    lines = [line for line in stream.getvalue().splitlines() if line]
    assert len(lines) == 1


def test_logger_falls_back_to_info_when_level_invalid(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "not-a-real-level")
    stream = io.StringIO()
    log = create_logger(stream=stream)
    log.debug("ignored")
    log.info("kept")
    lines = [line for line in stream.getvalue().splitlines() if line]
    assert len(lines) == 1


def test_logger_default_stream_is_stderr():
    # Just verify no exception when no stream supplied.
    log = create_logger(level="silent")
    log.info("no-op")


def test_mask_token_boundary_at_8_chars():
    assert mask_token("12345678") == "***"  # exactly 8 → masked fully
    assert "…" in mask_token("123456789")  # 9 chars → long path
