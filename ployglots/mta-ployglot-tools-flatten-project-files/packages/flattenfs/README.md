# flattenfs

Flatten a directory tree by depth with UUID filenames.

`flattenfs` walks a source directory and re-emits files into a target directory
with their path depth truncated to a user-chosen `N`, honoring `.gitignore` /
`.flattenignore` / CLI globs / an optional SDK veto predicate. Every output
filename gets a UUID v4 inserted before the last extension, so flattening two
different `file.txt` files into the same directory never collides.

The crate publishes both a library (SDK) and a CLI binary named `flattenfs`.

## Install

The crate is not yet published to crates.io. Install from a local checkout:

### Install locally (globally on your machine)

`cargo install --path` builds the release binary and drops it into
`~/.cargo/bin/`, which is already on `$PATH` for any shell that sources the
default cargo env. After this, `flattenfs` is available from any directory —
no aliases, no `./target/release/...` prefix.

```bash
# From the repo root:
cargo install --path packages/flattenfs --locked

# Or from inside the package dir:
cd packages/flattenfs && cargo install --path . --locked

# Verify it's on PATH:
which flattenfs
flattenfs --help

# Upgrade after pulling new changes:
cargo install --path packages/flattenfs --locked --force

# Uninstall:
cargo uninstall flattenfs
```

`--locked` makes the install deterministic (uses the committed `Cargo.lock`).
`--force` is required when re-installing over an existing binary of the same
name.

### Use as a library

```bash
# Sibling package in the same workspace
cargo add --path packages/flattenfs

# Or a git dependency in Cargo.toml
# flattenfs = { git = "https://github.com/<owner>/flattenfs" }
```

### Once published to crates.io

```bash
cargo install flattenfs    # CLI
cargo add flattenfs        # library
```

## CLI Usage

```bash
# Fully flat — every file at the root of ./flat.
flattenfs ./src ./flat --depth 0

# Preserve the first path segment; drop `*.log`.
flattenfs ./src ./flat --depth 1 --ignore '*.log'

# Dry-run + JSON — useful for scripting and verification.
flattenfs ./src ./flat --depth 2 --dry-run --json | jq
```

## Library Usage

```rust,no_run
use flattenfs::{flatten, ConfigBuilder};

let cfg = ConfigBuilder::new("/path/to/src", "/path/to/flat")
    .depth(1)
    .ignore("*.log")
    .build()
    .unwrap();

let report = flatten(cfg).unwrap();
println!("{} files copied ({} bytes)", report.files_processed, report.bytes_copied);
```

## Depth Semantics

`depth=N` preserves the first `N` path segments relative to the input root;
deeper segments collapse. `depth=0` means fully flat — every file ends up at
the output root with just its (UUID-suffixed) filename.

| Input relative       | depth | Output relative        |
| -------------------- | ----- | ---------------------- |
| `a/b/c/d/file.txt`   | 0     | `file-<uuid>.txt`      |
| `a/file03.txt`       | 0     | `file03-<uuid>.txt`    |
| `b/c/d/file.txt`     | 1     | `b/file-<uuid>.txt`    |
| `b/c/file.txt`       | 1     | `b/file-<uuid>.txt`    |

The UUID is inserted before the **last** dot in the filename, so
`archive.tar.gz` becomes `archive.tar-<uuid>.gz`.

## Ignore Precedence

Four independent filters can exclude a file. Any one of them excluding the
file is enough to skip it:

| Layer              | Source                                    | Stage      |
| ------------------ | ----------------------------------------- | ---------- |
| `.gitignore`       | ignore files at each tree level           | walker     |
| `.flattenignore`   | ignore files at each tree level           | walker     |
| CLI `--ignore`     | `OverrideBuilder` globs                   | walker     |
| SDK `predicate`    | `Arc<dyn Fn(&Path) -> bool + Send + Sync>`| post-walk  |

The SDK predicate is a **veto** layer, not an override. Returning `true` does
not un-ignore a file the walker already filtered out — the walker never
yielded it. Returning `false` unconditionally skips the file and records a
`Skipped` entry in the report.

## Exit Codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 0    | Success                                         |
| 2    | `InvalidConfig` (bad glob, bad argument combo)  |
| 3    | `InputNotFound` (input directory doesn't exist) |
| 4    | `OutputCreateFailed`                            |
| 5    | Walk or copy I/O error                          |

## License

Licensed under either of

- Apache License, Version 2.0 (LICENSE-APACHE)
- MIT license (LICENSE-MIT)

at your option.
