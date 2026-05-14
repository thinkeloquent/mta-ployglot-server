use flattenfs::{flatten, ConfigBuilder};
use std::sync::Arc;

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 2 {
        eprintln!("usage: sdk_with_predicate <input-dir> <output-dir>");
        std::process::exit(2);
    }

    // Skip any file larger than 1 MiB.
    let pred = Arc::new(|p: &std::path::Path| -> bool {
        std::fs::metadata(p)
            .map(|m| m.len() <= 1024 * 1024)
            .unwrap_or(true)
    });

    let cfg = ConfigBuilder::new(&args[0], &args[1])
        .depth(1)
        .predicate(pred)
        .build()?;
    let report = flatten(cfg)?;
    println!(
        "processed={} skipped={} bytes={}",
        report.files_processed, report.files_skipped, report.bytes_copied
    );
    Ok(())
}
