use drew_v::{VerifierContext, EncryptedData};
use blueprint_sdk::config::GadgetConfiguration;
use blueprint_sdk::alloy::primitives::B256;
use rand::Rng;

// Helper function to create random B256
fn random_b256() -> B256 {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    B256::from_slice(&bytes)
}

#[test]
fn test_verifier_context_creation() {
    // Create verifier context
    let context = VerifierContext {
        config: GadgetConfiguration::default(),
        tee_private_key: [0u8; 32],
    };
    
    // Verify context properties
    assert_eq!(context.tee_private_key.len(), 32);
}

#[test]
fn test_encrypted_data_creation() {
    // Create encrypted data
    let data = EncryptedData {
        encrypted_nullifier: vec![1, 2, 3],
        encrypted_private_key: vec![4, 5, 6],
    };
    
    // Verify data properties
    assert_eq!(data.encrypted_nullifier, vec![1, 2, 3]);
    assert_eq!(data.encrypted_private_key, vec![4, 5, 6]);
}

#[test]
fn test_random_b256_generation() {
    // Generate two random B256 values
    let b1 = random_b256();
    let b2 = random_b256();
    
    // Verify they are different
    assert_ne!(b1, b2, "Two random B256 values should not be equal");
} 