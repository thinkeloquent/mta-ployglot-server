---
name: loader-report
scope: fastapi_server
description: Build, mutate, and assert on LoaderReport instances. The canonical result shape every addon must return.
triggers:
  - "loader report"
  - "LoaderReport"
  - "report.errors"
  - "report_error"
---

# Skill — LoaderReport

## Shape (normative: `contracts/loader.schema.json`)

```python
@dataclass
class LoaderReportError:
    step: str           # one of: "discover" | "import" | "shape" | "register" | "run"
    error: str          # "TypeName: message"
    path: str | None    # file or directory involved, if any

@dataclass
class LoaderReport:
    name: str
    discovered: int = 0   # files/items found by scanning
    validated: int = 0    # passed cheap structural checks
    imported: int = 0     # successfully loaded / parsed
    registered: int = 0   # fully attached to the server/context
    skipped: int = 0      # intentionally ignored (shape mismatch, flag off)
    errors: list[LoaderReportError] = []
    details: dict[str, Any] = {}   # free-form per-addon (e.g., hook counts)
```

## Always construct via helpers

```python
from fastapi_server.bootstrap.contract import create_loader_report, report_error

report = create_loader_report("my-addon")        # name set, counters zeroed, errors=[]
# ...
report_error(report, "import", err, path=file)    # append a normalized error entry
```

Never build the dataclass by hand. `report_error` coerces `BaseException` → `"TypeName: message"`; calling it with a bare string works too.

## Counter invariants

| Counter | Meaning | Never-subtract rule |
| --- | --- | --- |
| `discovered` | How many candidates did I see? | Monotonic per run. |
| `validated`  | How many passed pre-import validation? | `≤ discovered`. |
| `imported`   | How many loaded without error? | `≤ validated + discovered`. |
| `registered` | How many actually attached to the server/ctx? | `≤ imported`. |
| `skipped`    | Imported but not registered (shape wrong, disabled, etc.). | `discovered >= registered + skipped - imported` holds informally. |

If you find yourself decrementing a counter, you're doing something wrong — revisit the flow instead.

## Error step vocabulary

Use the smallest verb that fits. Invent a new step only when necessary.

- `discover` — failed to list a directory / fetch a remote index.
- `import` — failed to load the module/file.
- `shape`  — loaded fine, but the exported shape was wrong.
- `register` — shape was fine, but attaching to the server failed.
- `run` — catch-all for unexpected exceptions from the addon body. The registry uses this as the fallback step too.

## Asserting in tests

```python
def test_my_addon_happy_path(tmp_path):
    # arrange fixtures ...
    report = my_addon.run(fake_server, fake_config, fake_ctx)
    assert report.name == "my-addon"
    assert report.errors == []
    assert report.registered == 1
    assert report.discovered >= report.registered
```

For failure paths, assert the structure — not the exact message:

```python
assert len(report.errors) == 1
assert report.errors[0].step == "import"
assert "ModuleNotFoundError" in report.errors[0].error
```

## Anti-patterns

- Emitting `print(...)` instead of `report_error(...)` — telemetry disappears.
- Mixing counter semantics (e.g. `registered` for "found" things you haven't attached).
- Free-form `step` strings like `"oops"`, `"fail"`, `"bad"`. Use the vocabulary above.
- Mutating `report` after it has been returned from `run`.
