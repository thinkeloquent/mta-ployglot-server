"""Logger factory — twin of packages/mjs/src/logger.mjs."""

from __future__ import annotations

import logging
from typing import Any


def create_logger(name: str = "app-yaml-config", _file: Any = None) -> logging.Logger:
    """Return a stdlib logger for the given name. Levels: debug, info, warn(ing), error."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
        logger.addHandler(handler)
    return logger
