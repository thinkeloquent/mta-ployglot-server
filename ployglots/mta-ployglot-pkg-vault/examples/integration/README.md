# Integration Examples

End-to-end smoke scenarios showing how `mta-ployglot-server-bootstrap` and
`mta-ployglot-server` can adopt this package. Nothing in this folder
modifies those repos — the addons are vendored here and the compose override
is layered at runtime.

## Prerequisites

These scenarios assume the two sibling repos are present:

- `/Users/Shared/autoload/mta-ployglot-server-bootstrap/`
- `/Users/Shared/autoload/mta-ployglot-server/`

If either is missing, the scenario exits 0 with a "skipped" marker.

## Scenarios

| #   | Scenario                                                        | What it demonstrates                                           |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| 01  | [Fastify addon](01-fastify-server-addon.md)                     | Typed addon calling `EnvStore.onStartup` during `onInit`.      |
| 02  | [FastAPI addon](02-fastapi-server-addon.md)                     | Py twin addon, FastAPI-bootstrap-compatible.                   |
| 03  | [Docker compose smoke](03-docker-compose-smoke.md)              | Compose override that injects the package into the runtime.    |
| 04  | [End-to-end smoke](04-end-to-end-smoke.md)                      | Full boot → healthz → down across both runtimes.               |
