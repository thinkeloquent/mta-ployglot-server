"""runtime_template_resolver — engine for {{path}}, {{fn:NAME}}, {{env.VAR}} patterns."""

__version__ = "0.1.0"

from .compute_registry import ComputeRegistry
from .context_resolver import (
    COMPUTE_PATTERN,
    ContextResolver,
    ENV_PATTERN,
    TEMPLATE_PATTERN,
    create_resolver,
    parse_default,
)
from .errors import (
    ComputeFunctionError,
    ErrorCode,
    RecursionLimitError,
    ScopeViolationError,
    SecurityError,
)
from .options import ComputeScope, MissingStrategy
from .security import Security

__all__ = [
    "ComputeRegistry",
    "COMPUTE_PATTERN",
    "ComputeFunctionError",
    "ComputeScope",
    "ContextResolver",
    "ENV_PATTERN",
    "ErrorCode",
    "MissingStrategy",
    "RecursionLimitError",
    "ScopeViolationError",
    "Security",
    "SecurityError",
    "TEMPLATE_PATTERN",
    "__version__",
    "create_resolver",
    "parse_default",
]
