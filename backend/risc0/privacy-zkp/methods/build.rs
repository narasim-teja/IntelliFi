use std::env;
use std::path::PathBuf;

fn main() {
    // Tell cargo to rerun this script if the guest code changes
    println!("cargo:rerun-if-changed=guest");

    // Build the RISC Zero methods
    risc0_build::embed_methods();
}
