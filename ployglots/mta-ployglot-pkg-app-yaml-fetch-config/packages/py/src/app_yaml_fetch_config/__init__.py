"""app_yaml_fetch_config — produce HTTP fetch ARGS from a loaded YAML config."""
__version__ = "0.1.0"

from .config import (
    get_config,
    get_endpoint,
    get_fetch_config,
    getConfig,
    getEndpoint,
    getFetchConfig,
    list_endpoints,
    listEndpoints,
    load_config,
    load_config_from_file,
    loadConfig,
    loadConfigFromFile,
    resolve_intent,
    resolveIntent,
)
from .errors import ConfigError
from .models import (
    create_endpoint_config,
    create_fetch_config,
    createEndpointConfig,
    createFetchConfig,
)
from .sdk import (
    EndpointConfigSDK,
    create_endpoint_config_sdk,
    createEndpointConfigSDK,
)

__all__ = [
    "__version__",
    "ConfigError",
    "EndpointConfigSDK",
    # snake_case
    "create_endpoint_config",
    "create_fetch_config",
    "create_endpoint_config_sdk",
    "load_config",
    "load_config_from_file",
    "get_config",
    "list_endpoints",
    "get_endpoint",
    "resolve_intent",
    "get_fetch_config",
    # camelCase parity aliases
    "createEndpointConfig",
    "createFetchConfig",
    "createEndpointConfigSDK",
    "loadConfig",
    "loadConfigFromFile",
    "getConfig",
    "listEndpoints",
    "getEndpoint",
    "resolveIntent",
    "getFetchConfig",
]
