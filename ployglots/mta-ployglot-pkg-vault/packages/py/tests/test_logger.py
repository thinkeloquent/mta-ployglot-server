from polyglot_vault_file.logger import Logger, LogLevel, get_logger, set_log_level


def test_logger_create_returns_logger_like():
    logger = Logger.create("pkg", "file")
    for method in ("debug", "info", "warn", "error"):
        assert hasattr(logger, method)


def test_get_logger_returns_default():
    assert get_logger() is not None


def test_set_log_level_runs():
    set_log_level(LogLevel.NONE)
    get_logger().info("this should not appear")
    set_log_level(LogLevel.DEBUG)
