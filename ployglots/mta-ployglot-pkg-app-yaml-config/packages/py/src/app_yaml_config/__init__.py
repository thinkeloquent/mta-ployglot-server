"""app_yaml_config — read-only configuration store over loaded YAML files."""

__version__ = "0.1.0"

from .core import AppYamlConfig
from .errors import ImmutabilityError
from .logger import create_logger
from .merge import deep_merge, merge_files, merge_global_into_providers
from .sdk import AppYamlConfigSDK

__all__ = [
    "__version__",
    "AppYamlConfig",
    "AppYamlConfigSDK",
    "ImmutabilityError",
    "create_logger",
    "deep_merge",
    "merge_files",
    "merge_global_into_providers",
]
