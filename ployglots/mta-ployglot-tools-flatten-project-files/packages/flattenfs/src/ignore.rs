//! Build `ignore::overrides::Override` from user glob strings.

use std::path::Path;

use ignore::overrides::{Override, OverrideBuilder};

use crate::error::FlattenError;

/// Compile a list of user globs into an `Override` object the walker can apply.
///
/// Each user glob is semantically an *ignore* rule. The `OverrideBuilder`
/// crate uses gitignore-style override semantics where a leading `!` means
/// "this pattern ignores matching files", so every incoming glob is prefixed
/// with `!` before being added.
pub fn build_overrides(root: &Path, globs: &[String]) -> Result<Override, FlattenError> {
    let mut b = OverrideBuilder::new(root);
    for g in globs {
        b.add(&format!("!{g}"))
            .map_err(|e| FlattenError::InvalidConfig(format!("bad glob '{g}': {e}")))?;
    }
    b.build()
        .map_err(|e| FlattenError::InvalidConfig(format!("override build failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn empty_list_builds_empty_override() {
        build_overrides(Path::new("/tmp"), &[]).unwrap();
    }

    #[test]
    fn bad_glob_returns_invalid_config() {
        let err = build_overrides(Path::new("/tmp"), &["[".to_string()]).unwrap_err();
        assert!(matches!(err, FlattenError::InvalidConfig(_)));
    }
}
