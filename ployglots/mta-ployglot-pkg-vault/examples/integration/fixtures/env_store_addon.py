"""Example addon for thinkeloquent-fastapi-server consumers.

Signature matches fastapi_server/.agents/addon-author.md from
mta-ployglot-server-bootstrap.
"""
from __future__ import annotations

import os
from typing import Any, Dict

from polyglot_vault_file import EnvStore


def env_store_addon(ctx: Any) -> Dict[str, Any]:
    """Loader addon — call during on_init phase."""
    try:
        result = EnvStore.on_startup(os.environ.get("VAULT_ENV_PATH", ".env"))
        ctx.report.info(f"vault-file: loaded {result.total_vars_loaded} vars")
        return ctx.report.ok(
            {"addon": "env_store", "totalVarsLoaded": result.total_vars_loaded}
        )
    except Exception as err:
        ctx.report.error(err)
        return ctx.report.fail({"addon": "env_store", "message": str(err)})
