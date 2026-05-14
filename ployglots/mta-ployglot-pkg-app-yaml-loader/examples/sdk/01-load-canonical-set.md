# SDK Example: Load canonical 6-file set

## Goal

Load the default 6-file canonical set from a config directory and inspect the returned map's key order.

## Prerequisites

- `examples/fixtures/canonical/` contains: `base.yml`, `security.yml`, `api-release-date.yml`, `feature_flags.yml`, `server.test.yaml`, `endpoint.test.yaml`.
- `APP_ENV=test` set, or pass `appEnv: 'test'` explicitly.

## Code (mjs)

```js
import { loadFromConfigDir } from '@ployglot/app-yaml-loader';

const map = await loadFromConfigDir({
  configDir: './examples/fixtures/canonical',
  appEnv: 'test',
});

for (const [path, parsed] of map.entries()) {
  console.log(path, '→', Object.keys(parsed).slice(0, 3));
}
```

## Code (py)

```python
from app_yaml_loader import load_from_config_dir

m = load_from_config_dir(config_dir="./examples/fixtures/canonical", app_env="test")
for path, parsed in m.items():
    print(path, "→", list(parsed.keys())[:3])
```

## Expected outcome

```
/abs/.../examples/fixtures/canonical/base.yml → [ 'global' ]
/abs/.../examples/fixtures/canonical/security.yml → [ 'security' ]
/abs/.../examples/fixtures/canonical/api-release-date.yml → [ 'api_release_date' ]
/abs/.../examples/fixtures/canonical/feature_flags.yml → [ 'feature_flags' ]
/abs/.../examples/fixtures/canonical/server.test.yaml → [ 'server' ]
/abs/.../examples/fixtures/canonical/endpoint.test.yaml → [ 'endpoint' ]
```

Iteration order matches insertion order = canonical priority.

## Notes

- This example does NOT merge the files into a single object — that is `app_yaml_config`'s job.
- Empty YAML files appear with `{}` value, not `null`.

## See also

- mjs implementation: `packages/mjs/src/loader.mjs`
- py implementation: `packages/py/src/app_yaml_loader/loader.py`
