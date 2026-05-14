//! flattenfs — flatten directory trees by depth with UUID filenames.
//!
//! This crate publishes both a library (the SDK) and a `flattenfs` binary.
//! The canonical entry point is [`flatten`]; build a [`Config`] with
//! [`ConfigBuilder`].

use std::path::PathBuf;
use std::time::Instant;

pub mod cli;
pub mod config;
pub mod copy;
pub mod depth;
pub mod error;
pub mod ignore;
pub mod rename;
pub mod report;
pub mod walk;

pub use config::{Config, ConfigBuilder, Predicate};
pub use error::FlattenError;
pub use report::{FileAction, FileOp, FlattenReport};

use walk::FileEntry;

/// Compute the final destination path for a single [`FileEntry`]:
/// depth truncation → (optional) UUID rename → join under `output_dir`.
pub(crate) fn resolve_destination(entry: &FileEntry, config: &Config) -> PathBuf {
    let truncated = depth::truncate_to_depth(&entry.relative, config.depth);

    let (parent, filename) = match truncated.parent().map(|p| p.to_path_buf()) {
        Some(p) if !p.as_os_str().is_empty() => {
            (Some(p), truncated.file_name().unwrap().to_os_string())
        }
        _ => (None, truncated.into_os_string()),
    };

    let final_name = if config.no_uuid {
        filename
    } else {
        rename::rename_with_uuid(&filename)
    };

    let mut dest = config.output_dir.clone();
    if let Some(p) = parent {
        dest.push(p);
    }
    dest.push(final_name);
    dest
}

/// Walk `config.input_dir`, re-emit every matching regular file under
/// `config.output_dir` with path depth truncated and a UUID suffix applied,
/// and return a [`FlattenReport`] describing what happened.
///
/// # Examples
///
/// ```no_run
/// use flattenfs::{flatten, ConfigBuilder};
///
/// let cfg = ConfigBuilder::new("/path/to/src", "/path/to/flat")
///     .depth(0)
///     .ignore("*.log")
///     .build()
///     .unwrap();
///
/// let report = flatten(cfg).unwrap();
/// println!("{} files copied", report.files_processed);
/// ```
pub fn flatten(config: Config) -> Result<FlattenReport, FlattenError> {
    let start = Instant::now();
    let mut report = FlattenReport::empty();

    if !config.dry_run {
        std::fs::create_dir_all(&config.output_dir).map_err(|e| {
            FlattenError::OutputCreateFailed {
                path: config.output_dir.clone(),
                source: e,
            }
        })?;
    }

    for entry_res in walk::walk_files(&config)? {
        let entry = entry_res?;

        if let Some(pred) = &config.predicate {
            if !pred(entry.absolute.as_path()) {
                report.files_skipped += 1;
                report.operations.push(FileOp {
                    source: entry.absolute.clone(),
                    destination: entry.absolute.clone(),
                    bytes: entry.size,
                    action: FileAction::Skipped,
                });
                continue;
            }
        }

        let dest = resolve_destination(&entry, &config);

        if config.dry_run {
            report.files_processed += 1;
            report.operations.push(FileOp {
                source: entry.absolute,
                destination: dest,
                bytes: entry.size,
                action: FileAction::DryRun,
            });
        } else {
            let bytes = copy::copy_file(&entry.absolute, &dest)?;
            report.files_processed += 1;
            report.bytes_copied += bytes;
            report.operations.push(FileOp {
                source: entry.absolute,
                destination: dest,
                bytes,
                action: FileAction::Copied,
            });
        }
    }

    report.duration_ms = start.elapsed().as_millis();
    Ok(report)
}

#[cfg(test)]
mod resolve_tests {
    use super::*;
    use crate::walk::FileEntry;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn depth_0_puts_file_at_output_root_no_uuid() {
        let tmp = tempdir().unwrap();
        let cfg = ConfigBuilder::new(tmp.path(), "/tmp/out")
            .depth(0)
            .no_uuid(true)
            .build()
            .unwrap();
        let entry = FileEntry {
            absolute: tmp.path().join("a/b/file.txt"),
            relative: PathBuf::from("a/b/file.txt"),
            size: 0,
        };
        let dest = resolve_destination(&entry, &cfg);
        assert_eq!(dest, PathBuf::from("/tmp/out/file.txt"));
    }

    #[test]
    fn no_uuid_flag_disables_rename() {
        let tmp = tempdir().unwrap();
        let cfg = ConfigBuilder::new(tmp.path(), "/tmp/out")
            .depth(0)
            .no_uuid(true)
            .build()
            .unwrap();
        let entry = FileEntry {
            absolute: tmp.path().join("a/file.txt"),
            relative: PathBuf::from("a/file.txt"),
            size: 0,
        };
        assert_eq!(
            resolve_destination(&entry, &cfg),
            PathBuf::from("/tmp/out/file.txt"),
        );
    }

    #[test]
    fn default_applies_uuid_suffix() {
        let tmp = tempdir().unwrap();
        let cfg = ConfigBuilder::new(tmp.path(), "/tmp/out")
            .depth(0)
            .build()
            .unwrap();
        let entry = FileEntry {
            absolute: tmp.path().join("a/file.txt"),
            relative: PathBuf::from("a/file.txt"),
            size: 0,
        };
        let dest = resolve_destination(&entry, &cfg);
        let name = dest.file_name().unwrap().to_string_lossy().into_owned();
        let re = regex::Regex::new(r"^file-[0-9a-f-]{36}\.txt$").unwrap();
        assert!(re.is_match(&name), "unexpected name: {name}");
    }
}
