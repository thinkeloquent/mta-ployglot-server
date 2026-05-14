use flattenfs::config::ConfigBuilder;
use flattenfs::walk::walk_files;
use std::collections::BTreeSet;

#[test]
fn cli_ignore_globs_are_applied() {
    let cfg = ConfigBuilder::new("tests/fixtures/nested", "/tmp/out")
        .ignore("**/file-c.txt")
        .build()
        .unwrap();
    let rels: BTreeSet<_> = walk_files(&cfg)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| e.relative.to_string_lossy().into_owned())
        .collect();
    assert!(!rels.contains("b/c/file-c.txt"));
    assert!(rels.contains("b/file-b.txt"));
}
