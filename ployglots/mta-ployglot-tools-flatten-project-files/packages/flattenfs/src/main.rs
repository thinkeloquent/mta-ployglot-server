use std::io;
use std::process::ExitCode;

use clap::Parser;

use flattenfs::cli::{build_config_from_cli, error_to_exit_code, format_human, format_json, Cli};
use flattenfs::flatten;

fn main() -> ExitCode {
    let cli = Cli::parse();

    let config = match build_config_from_cli(&cli) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}");
            return error_to_exit_code(&e);
        }
    };

    let json = cli.json;
    let verbose = cli.verbose;

    match flatten(config) {
        Ok(report) => {
            let out = io::stdout();
            let mut handle = out.lock();
            let res = if json {
                format_json(&report, &mut handle)
            } else {
                format_human(&report, verbose, &mut handle)
            };
            if let Err(e) = res {
                eprintln!("{e}");
                return ExitCode::from(5);
            }
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{e}");
            error_to_exit_code(&e)
        }
    }
}
