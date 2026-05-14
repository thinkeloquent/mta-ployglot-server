//! Report types returned by [`crate::flatten`].

use serde::Serialize;
use std::path::PathBuf;

/// The action that was (or would be) taken for a single file.
#[derive(Debug, Clone, Serialize)]
pub enum FileAction {
    /// The file was copied successfully.
    Copied,
    /// The file was skipped because the SDK predicate returned `false`.
    Skipped,
    /// No write was performed because `dry_run` was set.
    DryRun,
}

/// A single file operation recorded by the flattening pipeline.
#[derive(Debug, Clone, Serialize)]
pub struct FileOp {
    /// Absolute path to the source file.
    pub source: PathBuf,
    /// Computed destination path (even in dry-run mode).
    pub destination: PathBuf,
    /// Size of the source file in bytes.
    pub bytes: u64,
    /// What happened (or would happen) for this file.
    pub action: FileAction,
}

/// Summary of a single [`crate::flatten`] call.
#[derive(Debug, Clone, Serialize)]
pub struct FlattenReport {
    /// Files that the pipeline successfully processed (copied or dry-run).
    pub files_processed: u64,
    /// Files skipped by the SDK predicate.
    pub files_skipped: u64,
    /// Total bytes copied to disk (0 on dry-run).
    pub bytes_copied: u64,
    /// Per-file operations, in walk order.
    pub operations: Vec<FileOp>,
    /// Wall-clock duration of the flatten call in milliseconds.
    pub duration_ms: u128,
}

impl FlattenReport {
    /// Construct an empty report (zero counters, no operations).
    pub fn empty() -> Self {
        Self {
            files_processed: 0,
            files_skipped: 0,
            bytes_copied: 0,
            operations: vec![],
            duration_ms: 0,
        }
    }
}
