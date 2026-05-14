use flattenfs::config::ConfigBuilder;
use flattenfs::walk::walk_files;
use std::collections::BTreeSet;

#[test]
fn walker_yields_regular_files_only() {
    let cfg = ConfigBuilder::new("tests/fixtures/nested", "/tmp/out")
        .build()
        .unwrap();
    let rels: BTreeSet<_> = walk_files(&cfg)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| e.relative.to_string_lossy().into_owned())
        .collect();

    let expected: BTreeSet<_> = ["a/file-a.txt", "b/c/file-c.txt", "b/file-b.txt", "root.txt"]
        .iter()
        .map(|s| s.to_string())
        .collect();

    assert_eq!(rels, expected);
}

#[test]
fn walker_reports_file_size() {
    let cfg = ConfigBuilder::new("tests/fixtures/nested", "/tmp/out")
        .build()
        .unwrap();
    let root = walk_files(&cfg)
        .unwrap()
        .filter_map(Result::ok)
        .find(|e| e.relative.to_string_lossy() == "root.txt")
        .expect("root.txt present");
    assert_eq!(root.size, 4);
}
