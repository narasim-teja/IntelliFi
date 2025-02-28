fn main() {
    // This build script is required by napi-rs
    napi_build::setup();
    
    // Print a message to help with debugging
    println!("cargo:warning=Building privacy-zkp-native module");
} 