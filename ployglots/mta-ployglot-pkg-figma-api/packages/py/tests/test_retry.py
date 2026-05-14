import pytest

from figma_api import FIGMA_DEFAULT_RETRY, build_figma_retry_config


def test_empty_dict_gets_figma_defaults():
    cfg = build_figma_retry_config({})
    assert cfg is not None
    assert cfg.max_attempts == FIGMA_DEFAULT_RETRY["max_attempts"]
    assert cfg.base_delay == FIGMA_DEFAULT_RETRY["base_delay"]
    assert cfg.retry_on_status == FIGMA_DEFAULT_RETRY["retry_on_status"]


def test_false_disables_retry():
    assert build_figma_retry_config(False) is None
    assert build_figma_retry_config(None) is None


def test_true_uses_figma_defaults():
    cfg = build_figma_retry_config(True)
    assert cfg is not None
    assert cfg.max_attempts == 3


def test_user_opts_merge_on_top():
    cfg = build_figma_retry_config({"max_attempts": 5})
    assert cfg is not None
    assert cfg.max_attempts == 5
    assert cfg.base_delay == FIGMA_DEFAULT_RETRY["base_delay"]
    assert cfg.retry_on_status == FIGMA_DEFAULT_RETRY["retry_on_status"]


def test_force_overwrite_replaces_verbatim():
    cfg = build_figma_retry_config(
        {"max_attempts": 1, "retry_on_status": frozenset({503})},
        force_overwrite=True,
    )
    assert cfg is not None
    assert cfg.max_attempts == 1
    assert cfg.retry_on_status == frozenset({503})


def test_user_retry_on_status_wins_without_force():
    cfg = build_figma_retry_config({"retry_on_status": frozenset({418})})
    assert cfg is not None
    assert cfg.retry_on_status == frozenset({418})


def test_non_dict_input_raises():
    with pytest.raises(TypeError):
        build_figma_retry_config("bogus")  # type: ignore[arg-type]
