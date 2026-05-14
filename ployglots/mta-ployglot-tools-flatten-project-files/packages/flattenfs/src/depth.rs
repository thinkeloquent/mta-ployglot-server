//! Depth-based path truncation.

use std::path::{Component, Path, PathBuf};

/// Return a new path that keeps the first `depth` directory components of
/// `relative` and appends the file name. If `relative` has fewer directory
/// components than `depth`, returns `relative` unchanged.
///
/// Does not panic. Returns `relative.to_path_buf()` if the path has no file
/// name (which should not happen for regular files yielded by the walker).
///
/// # Examples
///
/// ```
/// use std::path::PathBuf;
/// use flattenfs::depth::truncate_to_depth;
///
/// assert_eq!(
///     truncate_to_depth(&PathBuf::from("a/b/c/d/file.txt"), 0),
///     PathBuf::from("file.txt"),
/// );
/// assert_eq!(
///     truncate_to_depth(&PathBuf::from("b/c/d/file.txt"), 1),
///     PathBuf::from("b/file.txt"),
/// );
/// ```
pub fn truncate_to_depth(relative: &Path, depth: u32) -> PathBuf {
    let file_name = match relative.file_name() {
        Some(n) => n,
        None => return relative.to_path_buf(),
    };

    let dir_components: Vec<&std::ffi::OsStr> = relative
        .parent()
        .map(|p| {
            p.components()
                .filter_map(|c| match c {
                    Component::Normal(s) => Some(s),
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default();

    let take = (depth as usize).min(dir_components.len());
    let mut out = PathBuf::new();
    for c in &dir_components[..take] {
        out.push(c);
    }
    out.push(file_name);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn p(s: &str) -> PathBuf {
        PathBuf::from(s)
    }

    #[test]
    fn depth_0_on_nested() {
        assert_eq!(truncate_to_depth(&p("a/b/c/d/file.txt"), 0), p("file.txt"));
    }
    #[test]
    fn depth_0_on_nested2() {
        assert_eq!(truncate_to_depth(&p("a/file03.txt"), 0), p("file03.txt"));
    }
    #[test]
    fn depth_1_bcd() {
        assert_eq!(truncate_to_depth(&p("b/c/d/file.txt"), 1), p("b/file.txt"));
    }
    #[test]
    fn depth_1_bc() {
        assert_eq!(truncate_to_depth(&p("b/c/file.txt"), 1), p("b/file.txt"));
    }
    #[test]
    fn depth_1_flat() {
        assert_eq!(truncate_to_depth(&p("file.txt"), 1), p("file.txt"));
    }
    #[test]
    fn depth_2_nested() {
        assert_eq!(
            truncate_to_depth(&p("b/c/d/file.txt"), 2),
            p("b/c/file.txt")
        );
    }
    #[test]
    fn depth_100_exceeds() {
        assert_eq!(
            truncate_to_depth(&p("b/c/d/file.txt"), 100),
            p("b/c/d/file.txt"),
        );
    }
}
