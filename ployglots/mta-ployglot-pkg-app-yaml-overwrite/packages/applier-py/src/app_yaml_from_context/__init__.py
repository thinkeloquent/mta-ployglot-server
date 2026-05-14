"""app_yaml_from_context — tree walker for overwrite_from_context / overwrite_from_env sections."""

__version__ = "0.1.0"

from .applier import apply_overwrites_from_context
from .deep_merge_null import deep_merge_with_null_replace
from .default_resolver import default_resolver

__all__ = [
    "__version__",
    "apply_overwrites_from_context",
    "deep_merge_with_null_replace",
    "default_resolver",
]
