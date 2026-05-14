from fastapi import FastAPI
from starlette.routing import Mount
from starlette.applications import Starlette
from print_routes_fastapi import print_routes


def test_print_routes_skips_non_apiroute(capsys):
    app = FastAPI()

    @app.get("/api/ping")
    def ping():
        return {"ok": True}

    # Add a non-APIRoute entry directly to app.routes
    sub = Starlette()
    app.routes.append(Mount("/static", app=sub))

    print_routes(app)

    captured = capsys.readouterr()
    assert "/api/ping" in captured.out
    assert "/static" not in captured.out, (
        "Mount routes must be filtered out — only APIRoute is printed"
    )
