use flattenfs::{flatten, ConfigBuilder};

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 2 {
        eprintln!("usage: sdk_basic <input-dir> <output-dir>");
        std::process::exit(2);
    }
    let cfg = ConfigBuilder::new(&args[0], &args[1]).depth(0).build()?;
    let report = flatten(cfg)?;
    println!("{report:#?}");
    Ok(())
}
