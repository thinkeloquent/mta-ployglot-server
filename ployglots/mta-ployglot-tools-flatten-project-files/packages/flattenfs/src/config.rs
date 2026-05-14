//! Configuration types for the flattenfs SDK.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::error::FlattenError;

/// User-supplied veto predicate. Runs after the walker on every yielded file;
/// returning `false` causes the file to be skipped.
pub type Predicate = Arc<dyn Fn(&Path) -> bool + Send + Sync>;

/// Immutable configuration consumed by [`crate::flatten`].
///
/// Construct via [`ConfigBuilder`] rather than building directly.
#[derive(Clone)]
#[allow(clippy::struct_excessive_bools)]
pub struct Config {
    /// Root directory to walk.
    pub input_dir: PathBuf,
    /// Root directory to populate.
    pub output_dir: PathBuf,
    /// Number of input-relative path components to preserve (0 = fully flat).
    pub depth: u32,
    /// CLI-style ignore globs, layered on top of `.gitignore`/`.flattenignore`.
    pub ignore_globs: Vec<String>,
    /// Optional SDK-only veto predicate (runs after the walker).
    pub predicate: Option<Predicate>,
    /// When `true`, no files are written; the report records planned ops only.
    pub dry_run: bool,
    /// When `true`, filenames are emitted verbatim (no UUID suffix).
    pub no_uuid: bool,
    /// When `true`, CLI emits per-file output in human mode (no effect on SDK).
    pub verbose: bool,
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("input_dir", &self.input_dir)
            .field("output_dir", &self.output_dir)
            .field("depth", &self.depth)
            .field("ignore_globs", &self.ignore_globs)
            .field("predicate", &self.predicate.as_ref().map(|_| "<fn>"))
            .field("dry_run", &self.dry_run)
            .field("no_uuid", &self.no_uuid)
            .field("verbose", &self.verbose)
            .finish()
    }
}

/// Fluent builder for [`Config`].
///
/// # Examples
///
/// ```no_run
/// use flattenfs::ConfigBuilder;
///
/// let cfg = ConfigBuilder::new("/path/to/src", "/path/to/flat")
///     .depth(1)
///     .ignore("*.log")
///     .dry_run(true)
///     .build()
///     .unwrap();
/// assert_eq!(cfg.depth, 1);
/// ```
pub struct ConfigBuilder {
    inner: Config,
}

impl ConfigBuilder {
    /// Start a new builder with the two required paths.
    pub fn new(input: impl Into<PathBuf>, output: impl Into<PathBuf>) -> Self {
        Self {
            inner: Config {
                input_dir: input.into(),
                output_dir: output.into(),
                depth: 0,
                ignore_globs: Vec::new(),
                predicate: None,
                dry_run: false,
                no_uuid: false,
                verbose: false,
            },
        }
    }

    /// Number of input-relative path components to preserve. `0` = fully flat.
    pub fn depth(mut self, d: u32) -> Self {
        self.inner.depth = d;
        self
    }

    /// Append a single ignore glob. Call repeatedly for multiple patterns.
    pub fn ignore(mut self, g: impl Into<String>) -> Self {
        self.inner.ignore_globs.push(g.into());
        self
    }

    /// Install a veto predicate (runs after the walker on every yielded file).
    pub fn predicate(mut self, p: Predicate) -> Self {
        self.inner.predicate = Some(p);
        self
    }

    /// When `true`, do not write to the filesystem; record planned ops only.
    pub fn dry_run(mut self, v: bool) -> Self {
        self.inner.dry_run = v;
        self
    }

    /// When `true`, emit filenames verbatim (no UUID suffix).
    pub fn no_uuid(mut self, v: bool) -> Self {
        self.inner.no_uuid = v;
        self
    }

    /// Verbose flag — consumed by the CLI layer; SDK ignores it.
    pub fn verbose(mut self, v: bool) -> Self {
        self.inner.verbose = v;
        self
    }

    /// Validate the configuration and return a [`Config`].
    ///
    /// Currently validates only that `input_dir` exists and is a directory.
    pub fn build(self) -> Result<Config, FlattenError> {
        if !self.inner.input_dir.is_dir() {
            return Err(FlattenError::InputNotFound(self.inner.input_dir));
        }
        Ok(self.inner)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn build_succeeds_on_existing_dir() {
        let tmp = tempdir().unwrap();
        let cfg = ConfigBuilder::new(tmp.path(), "/tmp/out")
            .depth(2)
            .build()
            .unwrap();
        assert_eq!(cfg.depth, 2);
    }

    #[test]
    fn build_fails_on_missing_input() {
        let err = ConfigBuilder::new("/no/such/dir", "/tmp/out")
            .build()
            .unwrap_err();
        assert!(matches!(err, FlattenError::InputNotFound(_)));
    }
}
