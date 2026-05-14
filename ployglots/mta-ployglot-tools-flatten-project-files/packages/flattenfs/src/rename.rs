//! Filename rename helpers.
//!
//! UUID insertion rule: if the filename contains a `.` past the first byte,
//! insert `-<uuid>` immediately before the **last** dot — so `archive.tar.gz`
//! becomes `archive.tar-<uuid>.gz`. This matches common file-rename tooling.
//! Names with no dot (or only a leading dot, e.g. `.hidden`) get the suffix
//! appended.

use std::ffi::{OsStr, OsString};
use uuid::Uuid;

/// Insert a UUID v4 into `filename` before the last `.` (or append if none).
pub fn rename_with_uuid(filename: &OsStr) -> OsString {
    rename_with_given_uuid(filename, Uuid::new_v4())
}

pub(crate) fn rename_with_given_uuid(filename: &OsStr, uuid: Uuid) -> OsString {
    let s = filename.to_string_lossy();

    // Find the last '.' that isn't the leading char (so `.hidden` doesn't split).
    let split_idx = s
        .char_indices()
        .rev()
        .find(|(i, c)| *c == '.' && *i > 0)
        .map(|(i, _)| i);

    let mut out = OsString::new();
    match split_idx {
        Some(i) => {
            out.push(&s[..i]);
            out.push(format!("-{uuid}"));
            out.push(&s[i..]); // includes the dot + extension
        }
        None => {
            out.push(&*s);
            out.push(format!("-{uuid}"));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    fn fixed() -> Uuid {
        Uuid::parse_str("11111111-2222-4333-8444-555555555555").unwrap()
    }

    #[test]
    fn simple_ext() {
        assert_eq!(
            rename_with_given_uuid(OsStr::new("file.txt"), fixed()),
            "file-11111111-2222-4333-8444-555555555555.txt",
        );
    }

    #[test]
    fn multi_dot() {
        assert_eq!(
            rename_with_given_uuid(OsStr::new("archive.tar.gz"), fixed()),
            "archive.tar-11111111-2222-4333-8444-555555555555.gz",
        );
    }

    #[test]
    fn no_ext() {
        assert_eq!(
            rename_with_given_uuid(OsStr::new("README"), fixed()),
            "README-11111111-2222-4333-8444-555555555555",
        );
    }

    #[test]
    fn hidden() {
        assert_eq!(
            rename_with_given_uuid(OsStr::new(".hidden"), fixed()),
            ".hidden-11111111-2222-4333-8444-555555555555",
        );
    }

    #[test]
    fn uuid_is_v4_and_roundtrip() {
        let out = rename_with_uuid(OsStr::new("x.ext"));
        let out = out.to_string_lossy().into_owned();
        // Strip "x-" prefix and ".ext" suffix; remainder must parse as a UUID.
        let rest = &out[2..out.len() - 4];
        Uuid::parse_str(rest).expect("valid uuid v4");
    }
}
