use drew_v as blueprint;
use blueprint::{FaceVerifier, FACE_VERIFIER_ADDRESS, VerifierContext};
use blueprint_sdk::alloy::primitives::{address, Address};
use blueprint_sdk::logging::{info, warn};
use blueprint_sdk::macros::main;
use blueprint_sdk::runners::core::runner::BlueprintRunner;
use blueprint_sdk::runners::eigenlayer::bls::EigenlayerBLSConfig;
use blueprint_sdk::utils::evm::get_provider_http;
use blueprint_sdk::tokio;
use rand::Rng;

#[main(env)]
async fn main() {
    info!("Initializing Face Verification AVS...");
    
    // Generate or load TEE private key
    let tee_private_key = generate_or_load_tee_key();
    info!("TEE private key initialized");
    
    // Create your service context with TEE private key
    let context = VerifierContext {
        config: env.clone(),
        tee_private_key,
    };
    info!("Context initialized with TEE configuration");

    // Get the provider
    let rpc_endpoint = env.http_rpc_endpoint.clone();
    let provider = get_provider_http(&rpc_endpoint);
    info!("Connected to RPC endpoint: {}", rpc_endpoint);

    // Create an instance of the face verifier contract
    let contract = FaceVerifier::new(*FACE_VERIFIER_ADDRESS, provider.clone());
    info!("FaceVerifier contract initialized at address: {}", *FACE_VERIFIER_ADDRESS);

    // Create the event handler from the job
    let face_verification_job = blueprint::ProcessFaceVerificationEventHandler::new(contract.clone(), context.clone());
    info!("Face verification job handler created");

    // Spawn a monitoring task
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            match contract.getCurrentRoot().call().await {
                Ok(root) => info!("Current Merkle tree root: {:?}", root),
                Err(e) => warn!("Failed to fetch current root: {:?}", e),
            }
        }
    });

    info!("Starting the AVS event watcher...");
    info!("Listening for CommitmentCreated events...");
    let eigen_config = EigenlayerBLSConfig::new(Address::default(), Address::default());
    
    // Start the runner with detailed logging
    match BlueprintRunner::new(eigen_config, env)
        .job(face_verification_job)
        .run()
        .await
    {
        Ok(_) => info!("AVS runner completed successfully"),
        Err(e) => {
            warn!("AVS runner encountered an error: {:?}", e);
            return Err(Box::new(e));
        }
    }

    info!("Face Verification AVS shutting down...");
    Ok(())
}

// Helper function to generate or load TEE private key
fn generate_or_load_tee_key() -> [u8; 32] {
    // In a production environment, you would load this from a secure storage
    // For development, we'll generate a random key
    if let Ok(key_str) = std::env::var("TEE_PRIVATE_KEY") {
        // Parse hex string to bytes
        if key_str.len() == 64 {
            let mut key = [0u8; 32];
            for i in 0..32 {
                let byte_str = &key_str[i*2..i*2+2];
                key[i] = u8::from_str_radix(byte_str, 16).unwrap_or(0);
            }
            return key;
        }
    }
    
    // Generate a random key if not found in environment
    let mut key = [0u8; 32];
    rand::thread_rng().fill(&mut key);
    
    // In a real implementation, you would save this key securely
    // For now, just log a warning
    warn!("Generated a new random TEE private key. This should be saved securely in production.");
    
    key
}
