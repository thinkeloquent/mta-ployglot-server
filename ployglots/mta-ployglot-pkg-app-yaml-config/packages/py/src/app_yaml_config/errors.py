"""Error classes — twin of packages/mjs/src/errors.mjs."""


class ImmutabilityError(Exception):
    """Raised when a caller attempts to mutate the read-only config store."""
