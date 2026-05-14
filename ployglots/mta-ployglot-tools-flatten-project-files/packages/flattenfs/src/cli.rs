//! CLI argument definitions, Config translation, output formatters, and
//! error → exit-code mapping. Re-exported from the library so the binary
//! target and downstream consumers can reuse them.

use std::io::{self, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;

use crate::config::{Config, ConfigBuilder};
use crate::error::FlattenError;
use crate::report::{FileAction, FlattenReport};

/// Parsed command-line arguments.
#[derive(Debug, Parser)]
#[command(
    name = "flattenfs",
    version,
    about = "Flatten a directory tree by depth with UUID filenames"
)]
pub struct Cli {
    /// Input directory to walk.
    #[arg(value_parser = clap::value_parser!(PathBuf))]
    pub input: PathBuf,

    /// Output directory to populate.
    #[arg(value_parser = clap::value_parser!(PathBuf))]
    pub output: PathBuf,

    /// Directory depth to preserve. 0 = fully flat.
    #[arg(short, long)]
    pub depth: u32,

    /// Gitignore-style pattern to exclude. Repeat for multiple.
    #[arg(short, long, value_name = "GLOB")]
    pub ignore: Vec<String>,

    /// Print planned operations without touching the filesystem.
    #[arg(long)]
    pub dry_run: bool,

    /// Emit a JSON report on stdout instead of the human summary.
    #[arg(long)]
    pub json: bool,

    /// Verbose per-file output in human mode.
    #[arg(short, long)]
    pub verbose: bool,

    /// Disable UUID filename suffixes (debug / test affordance).
    #[arg(long)]
    pub no_uuid: bool,
}

/// Pure mapping from the CLI flags to an SDK [`Config`].
pub fn build_config_from_cli(cli: &Cli) -> Result<Config, FlattenError> {
    let mut b = ConfigBuilder::new(cli.input.clone(), cli.output.clone())
        .depth(cli.depth)
        .dry_run(cli.dry_run)
        .no_uuid(cli.no_uuid)
        .verbose(cli.verbose);
    for g in &cli.ignore {
        b = b.ignore(g.clone());
    }
    b.build()
}

/// Write a concise human-readable summary for `report` to `w`.
pub fn format_human(report: &FlattenReport, verbose: bool, w: &mut impl Write) -> io::Result<()> {
    let dry = report
        .operations
        .iter()
        .any(|op| matches!(op.action, FileAction::DryRun));
    writeln!(
        w,
        "Copied {} files ({} bytes) in {} ms. Skipped: {}. Dry-run: {}.",
        report.files_processed,
        report.bytes_copied,
        report.duration_ms,
        report.files_skipped,
        if dry { "yes" } else { "no" }
    )?;
    if verbose {
        for op in &report.operations {
            writeln!(
                w,
                "  {:?}  {} -> {}",
                op.action,
                op.source.display(),
                op.destination.display()
            )?;
        }
    }
    Ok(())
}

/// Write a JSON document representing `report` to `w`. Stdout remains pure
/// JSON (trailing newline) so `jq`/`python3 -c 'json.load(sys.stdin)'` is happy.
pub fn format_json(report: &FlattenReport, w: &mut impl Write) -> io::Result<()> {
    serde_json::to_writer_pretty(&mut *w, report)?;
    writeln!(w)?;
    Ok(())
}

/// Map a [`FlattenError`] variant to the documented binary exit code.
pub fn error_to_exit_code(err: &FlattenError) -> ExitCode {
    match err {
        FlattenError::InvalidConfig(_) => ExitCode::from(2),
        FlattenError::InputNotFound(_) => ExitCode::from(3),
        FlattenError::OutputCreateFailed { .. } => ExitCode::from(4),
        FlattenError::WalkError { .. } | FlattenError::CopyError { .. } => ExitCode::from(5),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[test]
    fn minimal_positionals_and_depth() {
        let cli = Cli::parse_from(["flattenfs", "in", "out", "--depth", "2"]);
        assert_eq!(cli.input.to_str().unwrap(), "in");
        assert_eq!(cli.output.to_str().unwrap(), "out");
        assert_eq!(cli.depth, 2);
        assert!(!cli.dry_run && !cli.json && !cli.verbose && !cli.no_uuid);
        assert!(cli.ignore.is_empty());
    }

    #[test]
    fn repeatable_ignore() {
        let cli = Cli::parse_from([
            "flattenfs",
            "in",
            "out",
            "-d",
            "0",
            "-i",
            "*.log",
            "-i",
            "temp/**",
        ]);
        assert_eq!(cli.ignore, vec!["*.log", "temp/**"]);
    }

    #[test]
    fn all_flags() {
        let cli = Cli::parse_from([
            "flattenfs",
            "in",
            "out",
            "--depth",
            "3",
            "--dry-run",
            "--json",
            "--verbose",
            "--no-uuid",
        ]);
        assert!(cli.dry_run && cli.json && cli.verbose && cli.no_uuid);
    }

    #[test]
    fn missing_depth_errors() {
        let err = Cli::try_parse_from(["flattenfs", "in", "out"]).unwrap_err();
        assert_eq!(err.kind(), clap::error::ErrorKind::MissingRequiredArgument);
    }

    #[test]
    fn build_config_maps_fields() {
        let tmp = tempfile::tempdir().unwrap();
        let cli = Cli::parse_from([
            "flattenfs",
            tmp.path().to_str().unwrap(),
            "/tmp/out",
            "--depth",
            "1",
            "-i",
            "*.log",
            "--dry-run",
        ]);
        let cfg = build_config_from_cli(&cli).unwrap();
        assert_eq!(cfg.depth, 1);
        assert_eq!(cfg.ignore_globs, vec!["*.log".to_string()]);
        assert!(cfg.dry_run);
    }
}

#[cfg(test)]
mod fmt_tests {
    use super::*;
    use crate::report::{FileAction, FileOp, FlattenReport};
    use std::path::PathBuf;

    fn sample() -> FlattenReport {
        FlattenReport {
            files_processed: 2,
            files_skipped: 1,
            bytes_copied: 100,
            operations: vec![
                FileOp {
                    source: PathBuf::from("/in/a.txt"),
                    destination: PathBuf::from("/out/a-uuid.txt"),
                    bytes: 60,
                    action: FileAction::Copied,
                },
                FileOp {
                    source: PathBuf::from("/in/b.txt"),
                    destination: PathBuf::from("/out/b-uuid.txt"),
                    bytes: 40,
                    action: FileAction::Copied,
                },
            ],
            duration_ms: 5,
        }
    }

    #[test]
    fn human_non_verbose() {
        let mut buf = Vec::new();
        format_human(&sample(), false, &mut buf).unwrap();
        let s = String::from_utf8(buf).unwrap();
        assert!(s.starts_with("Copied 2 files (100 bytes)"));
        assert!(!s.contains("/in/a.txt"));
    }

    #[test]
    fn human_verbose_lists_ops() {
        let mut buf = Vec::new();
        format_human(&sample(), true, &mut buf).unwrap();
        let s = String::from_utf8(buf).unwrap();
        assert!(s.contains("/in/a.txt"));
        assert!(s.contains("/out/a-uuid.txt"));
    }

    #[test]
    fn json_is_valid() {
        let mut buf = Vec::new();
        format_json(&sample(), &mut buf).unwrap();
        let v: serde_json::Value = serde_json::from_slice(&buf).unwrap();
        assert_eq!(v["files_processed"], 2);
    }
}
