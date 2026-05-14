//! Directory walker yielding regular files with input-relative paths.

use std::path::{Path, PathBuf};

use ignore::{DirEntry, WalkBuilder};

use crate::config::Config;
use crate::error::FlattenError;

/// A regular file yielded by [`walk_files`].
#[derive(Debug, Clone)]
pub struct FileEntry {
    /// Absolute path to the source file.
    pub absolute: PathBuf,
    /// Path relative to `config.input_dir`, using OS-native separators.
    pub relative: PathBuf,
    /// File size in bytes.
    pub size: u64,
}

/// Walk `config.input_dir`, yielding one [`FileEntry`] per regular file.
///
/// Symlinks, directories, devices and fifos are skipped. `.gitignore`,
/// `.flattenignore`, and `config.ignore_globs` are honored by the underlying
/// [`WalkBuilder`]. The SDK predicate ([`Config::predicate`]) is applied by
/// the pipeline after the walker, not here.
pub fn walk_files(
    config: &Config,
) -> Result<impl Iterator<Item = Result<FileEntry, FlattenError>> + '_, FlattenError> {
    let overrides = crate::ignore::build_overrides(&config.input_dir, &config.ignore_globs)?;

    let mut builder = WalkBuilder::new(&config.input_dir);
    builder
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(false)
        .parents(true)
        .follow_links(false);
    builder.add_custom_ignore_filename(".flattenignore");
    builder.overrides(overrides);

    let input_root = config.input_dir.clone();

    Ok(builder.build().filter_map(move |res| match res {
        Ok(entry) => match to_file_entry(&entry, &input_root) {
            Ok(Some(fe)) => Some(Ok(fe)),
            Ok(None) => None,
            Err(e) => Some(Err(e)),
        },
        Err(err) => Some(Err(FlattenError::WalkError {
            path: PathBuf::new(),
            source: std::io::Error::other(err.to_string()),
        })),
    }))
}

fn to_file_entry(entry: &DirEntry, input_root: &Path) -> Result<Option<FileEntry>, FlattenError> {
    let ft = match entry.file_type() {
        Some(t) => t,
        None => return Ok(None),
    };
    if !ft.is_file() {
        return Ok(None);
    }

    let abs = entry.path().to_path_buf();
    let rel = abs
        .strip_prefix(input_root)
        .map_err(|_| FlattenError::WalkError {
            path: abs.clone(),
            source: std::io::Error::other("path outside input root"),
        })?
        .to_path_buf();
    let size = entry.metadata().ok().map(|m| m.len()).unwrap_or(0);

    Ok(Some(FileEntry {
        absolute: abs,
        relative: rel,
        size,
    }))
}
