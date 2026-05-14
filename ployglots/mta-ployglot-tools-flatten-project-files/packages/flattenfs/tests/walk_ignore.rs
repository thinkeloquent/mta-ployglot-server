use flattenfs::config::ConfigBuilder;
use flattenfs::walk::walk_files;
use std::collections::BTreeSet;

#[test]
fn honors_gitignore_flattenignore_and_negation() {
    let cfg = ConfigBuilder::new("tests/fixtures/ignore", "/tmp/out")
        .build()
        .unwrap();
    let rels: BTreeSet<_> = walk_files(&cfg)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| e.relative.to_string_lossy().into_owned())
        .collect();

    let expected: BTreeSet<_> = [
        "keep.txt",
        "keep.tmp",
        "docs/public.md",
        ".gitignore",
        ".flattenignore",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();

    assert_eq!(rels, expected);
}
