use flattenfs::{flatten, ConfigBuilder, FileAction};
use std::collections::BTreeSet;
use tempfile::tempdir;

#[test]
fn depth_zero_produces_flat_output() {
    let out = tempdir().unwrap();
    let cfg = ConfigBuilder::new("tests/fixtures/nested", out.path())
        .depth(0)
        .build()
        .unwrap();
    let report = flatten(cfg).unwrap();

    assert_eq!(report.files_processed, 4);
    for op in &report.operations {
        assert!(matches!(op.action, FileAction::Copied));
    }

    let names: BTreeSet<_> = std::fs::read_dir(out.path())
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(
        names.len(),
        4,
        "four files at output root (one per input leaf)"
    );
}

#[test]
fn dry_run_writes_nothing() {
    let out = tempdir().unwrap();
    let cfg = ConfigBuilder::new("tests/fixtures/nested", out.path())
        .depth(0)
        .dry_run(true)
        .build()
        .unwrap();
    let report = flatten(cfg).unwrap();

    assert_eq!(report.files_processed, 4);
    for op in &report.operations {
        assert!(matches!(op.action, FileAction::DryRun));
    }
    assert_eq!(std::fs::read_dir(out.path()).unwrap().count(), 0);
}
