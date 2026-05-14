"""Single mock HTTP origin matching every upstream URL the six providers hit."""

from __future__ import annotations

import json
import re
import threading
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, HTTPServer

ROUTES = {
    ("GET", "/rest/api/3/myself"): {
        "accountId": "acc-1",
        "displayName": "Mock User",
        "emailAddress": "mock@x.io",
    },
    ("GET", "/wiki/rest/api/user/current"): {
        "type": "known",
        "accountId": "acc-conf-1",
        "accountType": "atlassian",
        "email": "mock@confluence.io",
        "publicName": "Mock Confluence User",
        "displayName": "Mock Confluence User",
    },
    ("GET", "/user"): {
        "login": "mockoctocat",
        "id": 42,
        "name": "Mock Octocat",
        "email": "octo@x.io",
    },
    ("GET", "/v1/me"): {
        "id": "u-1",
        "email": "mock@figma.io",
        "handle": "mockfigma",
    },
    ("GET", "/gates"): {
        "data": [{"id": "g-1", "name": "mock_gate", "isEnabled": True}]
    },
}

_SAUCE_RE = re.compile(r"^/rest/v1/users/[^/]+/concurrency$")


def _match(method: str, path: str):
    if (method, path) in ROUTES:
        return ROUTES[(method, path)]
    if method == "GET" and _SAUCE_RE.match(path):
        return {
            "concurrency": {
                "organization": {"allowed": {"vms": 100, "mac_vms": 10, "rds": 1}},
                "team": {"allowed": {"vms": 50, "mac_vms": 5, "rds": 1}},
            }
        }
    return None


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        path = self.path.split("?")[0]
        body = _match("GET", path)
        if body is None:
            body = {"error": f"no mock for GET {self.path}"}
            code = 404
        else:
            code = 200
        payload = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):
        pass


def start_mock() -> tuple[str, Callable[[], None]]:
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}"

    def stop():
        server.shutdown()
        server.server_close()

    return url, stop
