# API Examples

Public function-signature contract for `app-yaml-loader`.

## Surface kind

mjs is `async`/`await` (Node `fs/promises`); py is sync (matching the source extract — disk reads for a handful of YAML files don't justify Python `asyncio` overhead).

## Entries

| #   | Entry                                            | Description                              |
| --- | ------------------------------------------------ | ---------------------------------------- |
| 01  | [`loadFiles` / `load_files`](01-loadFiles.md)    | Read + parse + return ordered map.       |
| 02  | [`buildConfigFiles`](02-buildConfigFiles.md)     | Derive the canonical 6-file path list.   |
