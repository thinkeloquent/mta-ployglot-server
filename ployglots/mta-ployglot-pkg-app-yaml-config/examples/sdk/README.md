# SDK Examples

Programmatic embedding of `app-yaml-config`.

## Setup

```bash
cd packages/mjs && npm install && make build
cd packages/py  && pip install -e .[loader] && make build
```

## Scenarios

| #   | Scenario                                                | Description                              |
| --- | ------------------------------------------------------- | ---------------------------------------- |
| 01  | [Load and query](01-load-and-query.md)                  | `fromDirectory` + list/get.              |
| 02  | [Globalize providers](02-globalize-providers.md)        | Demonstrate the `global → providers` propagation. |
