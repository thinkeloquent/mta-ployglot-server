from app_yaml_fetch_config import ConfigError


def test_config_error_fields_populated():
    e = ConfigError("boom", "svc1", ["a", "b"])
    assert isinstance(e, Exception)
    assert str(e) == "boom"
    assert e.message == "boom"
    assert e.service_id == "svc1"
    assert e.serviceId == "svc1"  # parity alias
    assert e.available == ["a", "b"]


def test_config_error_defaults():
    e = ConfigError("boom")
    assert e.service_id is None
    assert e.serviceId is None
    assert e.available == []
