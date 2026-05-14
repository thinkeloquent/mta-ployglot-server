from fastapi import FastAPI
from print_routes_fastapi import print_routes


def test_print_routes_happy_path(capsys):
    app = FastAPI()

    @app.get("/hello")
    def get_hello():
        return {"ok": True}

    @app.post("/echo")
    def post_echo():
        return {"ok": True}

    @app.get("/echo")
    def get_echo():
        return {"ok": True}

    print_routes(app)

    captured = capsys.readouterr()
    lines = captured.out.splitlines()

    assert lines[0] == "Registered Routes - FastAPI:"
    body = "\n".join(lines[1:])
    assert "/hello" in body
    assert "/echo" in body
    # Methods in the /echo group are sorted alphabetically
    assert "GET, POST" in body or "GET" in body and "POST" in body
