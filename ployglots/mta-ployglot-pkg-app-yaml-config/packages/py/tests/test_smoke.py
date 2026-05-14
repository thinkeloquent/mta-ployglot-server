from app_yaml_config import __version__


def test_package_loads():
    assert __version__ == "0.1.0"
