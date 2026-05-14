# API — `parseEnvFile` / `parse_env_file`

## Goal

Parse a dotenv-format file into a flat `{ key: value }` map. Standalone — does
not mutate the env store.

## Signature / Contract

```ts
// TS
parseEnvFile(filePath: string): Record<string, string>
```

```python
# Py
def parse_env_file(file_path: str) -> Dict[str, str]
```

## Inputs

| Name        | Type   | Required | Description                         |
| ----------- | ------ | -------- | ----------------------------------- |
| `filePath`  | string | yes      | Path to the dotenv-format file.     |

## Outputs

A plain object / dict mapping key → value. Values are unquoted (both
double-quoted and single-quoted forms are stripped); comments (`# ...`) and
blank lines are skipped.

## Errors / Failure modes

- Empty path → `Error("File path is required")` / `ValueError`.
- Missing file → empty map (no throw).
- Unreadable path (e.g. directory, permissions) → underlying fs error bubbles up.

## Example

```ts
import { parseEnvFile } from '@polyglot/vault-file';
const env = parseEnvFile('/etc/app/.env');
console.log(env.DATABASE_URL);
```

```python
from polyglot_vault_file import parse_env_file
env = parse_env_file("/etc/app/.env")
print(env["DATABASE_URL"])
```

## Notes

- Quoting rules: matching leading + trailing `"` or `'` are stripped. Mixed
  or unmatched quotes are preserved literally.
- Lines without `=` are logged via the module logger and skipped — they
  don't fail the parse.
