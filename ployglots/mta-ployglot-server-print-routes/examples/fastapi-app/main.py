from contextlib import asynccontextmanager
from fastapi import FastAPI
from print_routes_fastapi import print_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    print_routes(app)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/hello")
def get_hello():
    return {"message": "hello"}


@app.post("/echo")
def post_echo(payload: dict):
    return {"got": payload}
