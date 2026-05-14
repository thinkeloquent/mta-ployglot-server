//! Error type for the flattenfs SDK.

use std::path::PathBuf;
use thiserror::Error;

/// Error variants returned by the SDK surface.
#[derive(Debug, Error)]
pub enum FlattenError {
    /// Configuration failed validation (bad glob, invalid combination, etc.).
    #[error("invalid config: {0}")]
    InvalidConfig(String),

    /// The requested input directory does not exist or is not a directory.
    #[error("input directory not found: {0}")]
    InputNotFound(PathBuf),

    /// Creating the output directory (or a parent of a destination) failed.
    #[error("failed to create output directory {path}: {source}")]
    OutputCreateFailed {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// An error occurred while walking the input tree.
    #[error("walk error at {path}: {source}")]
    WalkError {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// An error occurred while copying a specific file.
    #[error("copy error {src} -> {dst}: {source}")]
    CopyError {
        src: PathBuf,
        dst: PathBuf,
        #[source]
        source: std::io::Error,
    },
}
