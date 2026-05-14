//! File copy with parent-directory creation.

use std::path::Path;

use crate::error::FlattenError;

/// Copy `src` to `dst`, creating `dst.parent()` recursively if needed.
/// Returns the number of bytes copied.
pub fn copy_file(src: &Path, dst: &Path) -> Result<u64, FlattenError> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent).map_err(|e| FlattenError::OutputCreateFailed {
            path: parent.to_path_buf(),
            source: e,
        })?;
    }
    std::fs::copy(src, dst).map_err(|e| FlattenError::CopyError {
        src: src.to_path_buf(),
        dst: dst.to_path_buf(),
        source: e,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_parents_then_copies() {
        let tmp = tempdir().unwrap();
        let src = tmp.path().join("src.txt");
        std::fs::write(&src, b"hello world").unwrap();

        let dst = tmp.path().join("nested/dirs/dst.txt");
        let bytes = copy_file(&src, &dst).unwrap();
        assert_eq!(bytes, 11);
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), "hello world");
    }

    #[test]
    fn copy_error_variant_on_missing_src() {
        let tmp = tempdir().unwrap();
        let dst = tmp.path().join("dst.txt");
        let err = copy_file(Path::new("/no/such/src"), &dst).unwrap_err();
        assert!(matches!(err, FlattenError::CopyError { .. }));
    }
}
