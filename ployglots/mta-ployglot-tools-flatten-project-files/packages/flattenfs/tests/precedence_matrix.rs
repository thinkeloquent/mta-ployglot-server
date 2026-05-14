use flattenfs::{flatten, ConfigBuilder, FileAction};
use std::sync::Arc;
use tempfile::tempdir;

struct Case {
    name: &'static str,
    ignore_globs: Vec<&'static str>,
    predicate_result: Option<bool>, // None = no predicate
    expect_target_copied: bool,
}

fn cases() -> Vec<Case> {
    vec![
        Case {
            name: "all-layers-ignore-no-predicate",
            ignore_globs: vec!["target.txt"],
            predicate_result: None,
            expect_target_copied: false,
        },
        // Predicate is a veto layer (runs *after* walker), so returning `true` cannot un-ignore
        // a file the walker never yielded. The documented precedence applies only when the walker
        // yields the file.
        Case {
            name: "predicate-overrides-all-with-true-BUT-other-layers-still-ignore",
            ignore_globs: vec!["target.txt"],
            predicate_result: Some(true),
            expect_target_copied: false,
        },
        // The fixture's persistent .gitignore already excludes target.txt at the walker
        // layer, so predicate=true has nothing to reinstate (veto semantics).
        Case {
            name: "no-cli-layers-predicate-true-but-gitignore-still-ignores",
            ignore_globs: vec![],
            predicate_result: Some(true),
            expect_target_copied: false,
        },
        Case {
            name: "no-cli-layers-predicate-false",
            ignore_globs: vec![],
            predicate_result: Some(false),
            expect_target_copied: false,
        },
        Case {
            name: "only-gitignore-no-predicate",
            ignore_globs: vec![],
            predicate_result: None,
            expect_target_copied: false,
        },
    ]
}

#[test]
fn precedence_matrix() {
    for case in cases() {
        let out = tempdir().unwrap();
        let mut builder = ConfigBuilder::new("tests/fixtures/precedence", out.path()).depth(0);
        for g in &case.ignore_globs {
            builder = builder.ignore(*g);
        }
        if let Some(v) = case.predicate_result {
            builder = builder.predicate(Arc::new(move |_p| v));
        }
        let cfg = builder.build().unwrap();
        let report = flatten(cfg).unwrap();

        let copied = report.operations.iter().any(|op| {
            matches!(op.action, FileAction::Copied)
                && op.source.file_name().unwrap() == "target.txt"
        });
        assert_eq!(copied, case.expect_target_copied, "case: {}", case.name);
    }
}

// Positive coverage: a file NOT matched by any walker-layer rule is passed
// through, and the predicate can either copy it (true) or veto it (false).
#[test]
fn predicate_controls_unignored_files() {
    // predicate = true → unrelated.txt is copied.
    let out_true = tempdir().unwrap();
    let cfg_true = ConfigBuilder::new("tests/fixtures/precedence", out_true.path())
        .depth(0)
        .predicate(Arc::new(|_p| true))
        .build()
        .unwrap();
    let report_true = flatten(cfg_true).unwrap();
    assert!(report_true.operations.iter().any(|op| {
        matches!(op.action, FileAction::Copied) && op.source.file_name().unwrap() == "unrelated.txt"
    }));

    // predicate = false → unrelated.txt is skipped.
    let out_false = tempdir().unwrap();
    let cfg_false = ConfigBuilder::new("tests/fixtures/precedence", out_false.path())
        .depth(0)
        .predicate(Arc::new(|_p| false))
        .build()
        .unwrap();
    let report_false = flatten(cfg_false).unwrap();
    assert!(!report_false.operations.iter().any(|op| {
        matches!(op.action, FileAction::Copied) && op.source.file_name().unwrap() == "unrelated.txt"
    }));
}
