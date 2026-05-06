"""Environment defaults for fastapi_server. Imported side-effect style."""

import os

os.environ.setdefault("BUILD_ID", "local-dev")
os.environ.setdefault("BUILD_VERSION", "0.0.0")
os.environ.setdefault("APP_ENV", "local")
