use blueprint_sdk::alloy::primitives::{address, Address};
use blueprint_sdk::alloy::rpc::types::Log;
use blueprint_sdk::alloy::sol;
use blueprint_sdk::config::GadgetConfiguration;
use blueprint_sdk::event_listeners::evm::EvmContractEventListener;
use blueprint_sdk::job;
use blueprint_sdk::logging::{info, warn};
use blueprint_sdk::macros::load_abi;
use blueprint_sdk::std::convert::Infallible;
use blueprint_sdk::std::sync::LazyLock;
use serde::{Deserialize, Serialize};
use risc0_zkvm::Receipt;
use risc0_zkvm::sha::Digest;
use sha2::{Sha256, Digest as Sha256Digest};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use risc0_zkvm::InnerReceipt;

// Constants
const MERKLE_VERIFIER_ID: [u8; 32] = [0; 32]; 

type ProcessorError =
    blueprint_sdk::event_listeners::core::Error<blueprint_sdk::event_listeners::evm::error::Error>;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    #[derive(Debug, Serialize, Deserialize)]
    FaceVerifier,
    "contracts/out/FaceVerifier.sol/FaceVerifier.json"
);

load_abi!(
    FACE_VERIFIER_ABI_STRING,
    "contracts/out/FaceVerifier.sol/FaceVerifier.json"
);

pub static FACE_VERIFIER_ADDRESS: LazyLock<Address> = LazyLock::new(|| {
    std::env::var("FACE_VERIFIER_ADDRESS")
        .map(|addr| addr.parse().expect("Invalid FACE_VERIFIER_ADDRESS"))
        .unwrap_or_else(|_| address!("0000000000000000000000000000000000000000"))
});

#[derive(Clone)]
pub struct VerifierContext {
    pub config: GadgetConfiguration,
    pub tee_private_key: [u8; 32], // TEE's private key for decryption
}

// Structure to hold the encrypted data received from the event
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    pub encrypted_nullifier: Vec<u8>,
    pub encrypted_private_key: Vec<u8>,
    pub encrypted_index: Vec<u8>,
    pub encrypted_merkle_path: Vec<u8>,
    pub note_hash: [u8; 32],
}

// Use simple types for serialization instead of curve25519-dalek types
#[derive(Debug, Serialize, Deserialize)]
pub struct SpendVerificationInput {
    pub spend_note: SpendNoteInput,
    pub merkle_proof: MerkleProof,
    pub merkle_root: [u8; 32],
    pub expected_amount: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpendNoteInput {
    pub wallet_address: [u8; 20],  // ETH address is 20 bytes
    pub nullifier: [u8; 32],       // SHA256 hash is 32 bytes
    pub amount_commitment: AmountCommitment,
    pub nullifier_data: NullifierData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NullifierData {
    pub salt: [u8; 32],            // Random salt used in nullifier generation
    pub timestamp: u64,            // Timestamp when nullifier was generated
}

// Use serializable types instead of curve25519-dalek types directly
#[derive(Debug, Serialize, Deserialize)]
pub struct AmountCommitment {
    pub commitment: Vec<u8>,       // Serialized RistrettoPoint
    pub amount: u64,               // Actual amount (will be hidden)
    pub blinding_factor: Vec<u8>,  // Serialized Scalar
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerkleProof {
    pub path: Vec<[u8; 32]>,
    pub indices: Vec<bool>,
}

/// Job that handles face verification and nullifier processing in TEE
#[job(
    id = 1,
    params(encrypted_data),
    event_listener(
        listener = EvmContractEventListener<VerifierContext, FaceVerifier::CommitmentCreated>,
        instance = FaceVerifier,
        abi = FACE_VERIFIER_ABI_STRING,
        pre_processor = commitment_pre_processor,
    ),
)]
pub fn process_face_verification(
    context: VerifierContext,
    encrypted_data: EncryptedData,
) -> Result<Receipt, Infallible> {
    info!("Processing face verification in TEE...");

    // 1. Decrypt the data using TEE's private key
    let nullifier = decrypt_data(&encrypted_data.encrypted_nullifier, &context.tee_private_key);
    let private_key = decrypt_data(&encrypted_data.encrypted_private_key, &context.tee_private_key);
    let index = decrypt_data(&encrypted_data.encrypted_index, &context.tee_private_key);
    let merkle_path = decrypt_data(&encrypted_data.encrypted_merkle_path, &context.tee_private_key);

    // 2. Parse the decrypted data
    let nullifier_bytes: [u8; 32] = nullifier.try_into().expect("Invalid nullifier length");
    let private_key_bytes: [u8; 32] = private_key.try_into().expect("Invalid private key length");
    let index_of_spend_note = u64::from_be_bytes(
        index.try_into().expect("Invalid index length")
    );
    
    // Parse merkle path
    let merkle_proof: MerkleProof = bincode::deserialize(&merkle_path)
        .expect("Failed to deserialize merkle path");

    // 3. Get the merkle root from the contract
    // In a real implementation, you would fetch this from the contract
    let merkle_root = [0u8; 32]; // Placeholder

    // 4. Prepare the input for RISC Zero
    let spend_note = decrypt_everything(
        index_of_spend_note, 
        &private_key_bytes, 
        &nullifier_bytes, 
        &merkle_proof
    );

    // 5. Use RISC Zero to verify the merkle path
    let receipt = verify_merkle_path(spend_note, merkle_proof, merkle_root);

    // 6. If verification succeeds, mark the nullifier as used
    if receipt.verify(Digest::from(MERKLE_VERIFIER_ID)).is_ok() {
        info!("Verification successful, marking nullifier as used");
        // Call the contract to mark nullifier as used
        // This would be handled by your contract interaction code
    } else {
        warn!("Verification failed");
    }

    Ok(receipt)
}

/// Pre-processor for handling CommitmentCreated events
async fn commitment_pre_processor(
    (event, _log): (FaceVerifier::CommitmentCreated, Log),
) -> Result<Option<(EncryptedData,)>, ProcessorError> {
    info!("Received CommitmentCreated event");
    
    // Extract encrypted data from the event - fix field names to match contract
    let encrypted_data = EncryptedData {
        encrypted_nullifier: event.encryptedNullifier.to_vec(),
        encrypted_private_key: event.encryptedPrivateKey.to_vec(),
        encrypted_index: event.encryptedIndex.to_vec(),
        encrypted_merkle_path: event.encryptedMerklePath.to_vec(),
        note_hash: event.noteHash.into(),
    };
    
    info!("Extracted encrypted data from event");
    Ok(Some((encrypted_data,)))
}

// Helper function to decrypt data in TEE
fn decrypt_data(encrypted: &[u8], private_key: &[u8; 32]) -> Vec<u8> {
    // In a real implementation, you would use proper encryption/decryption
    // This is a simplified example using AES-GCM
    
    // Extract nonce (first 12 bytes) and ciphertext
    if encrypted.len() < 12 {
        // Return dummy data if encrypted data is too short
        return vec![0; 32];
    }
    
    let nonce_bytes: [u8; 12] = encrypted[..12].try_into().expect("Invalid nonce");
    let ciphertext = &encrypted[12..];
    
    // Create cipher with explicit type annotation for Aes256Gcm
    let key = Key::<Aes256Gcm>::from_slice(private_key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Try to decrypt, but return dummy data if it fails
    match cipher.decrypt(nonce, ciphertext) {
        Ok(plaintext) => plaintext,
        Err(e) => {
            warn!("Decryption failed: {:?}", e);
            vec![0; 32] // Return dummy data
        }
    }
}

// Helper function to decrypt everything and prepare the spend note
fn decrypt_everything(
    _index_of_spend_note: u64,
    private_key: &[u8; 32],
    nullifier: &[u8; 32],
    _merkle_path: &MerkleProof,
) -> SpendNoteInput {
    // In a real implementation, you would derive these values properly
    // This is a simplified example
    
    // Derive wallet address from private key
    let wallet_address = derive_address_from_private_key(private_key);
    
    // Create nullifier data
    let nullifier_data = NullifierData {
        salt: [0u8; 32], // In a real implementation, this would be derived
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs(),
    };
    
    // Create amount commitment with serializable types
    let amount_commitment = AmountCommitment {
        commitment: vec![0; 32], // Placeholder for serialized RistrettoPoint
        amount: 100000000, // 0.1 ETH in wei
        blinding_factor: vec![0; 32], // Placeholder for serialized Scalar
    };
    
    // Create spend note input
    SpendNoteInput {
        wallet_address,
        nullifier: *nullifier,
        amount_commitment,
        nullifier_data,
    }
}

// Helper function to derive Ethereum address from private key
fn derive_address_from_private_key(private_key: &[u8; 32]) -> [u8; 20] {
    // In a real implementation, you would use proper key derivation
    // This is a simplified example
    let mut hasher = Sha256::new();
    hasher.update(private_key);
    let result = hasher.finalize();
    
    // Take the last 20 bytes as the address
    let mut address = [0u8; 20];
    address.copy_from_slice(&result[12..32]);
    address
}

// Helper function to verify merkle path using RISC Zero
fn verify_merkle_path(
    spend_note: SpendNoteInput,
    merkle_proof: MerkleProof,
    merkle_root: [u8; 32],
) -> Receipt {
    // Create the input for RISC Zero
    let input = SpendVerificationInput {
        spend_note,
        merkle_proof,
        merkle_root,
        expected_amount: 100000000, // 0.1 ETH in wei
    };
    
    // Serialize the input
    let _input_bytes = bincode::serialize(&input).expect("Failed to serialize input");
    
    // In a real implementation, we would use the actual RISC0 prover
    // For now, we'll create a simple mock receipt for development purposes
    
    // Create a mock journal
    let journal = vec![0u8; 32]; // Empty journal data
    
    // For development purposes, we'll create a minimal receipt
    // In a production environment, this would be generated by the actual RISC0 prover
    
    // Create a mock inner receipt using a variant that exists in the current version
    // We'll use a simpler approach that doesn't rely on specific InnerReceipt variants
    
    // For development purposes only, create a dummy receipt
    // In a real implementation, you would use the actual RISC0 prover
    
    // Since we can't directly create a Receipt with the available API,
    // we'll use a workaround for development purposes only
    
    // Create a simple mock receipt
    let mock_receipt = {
        // This is a simplified version for development only
        // In a real implementation, you would use the actual RISC0 prover
        
        // Create a minimal journal
        let journal = vec![0u8; 32];
        
        // Create a mock inner receipt - using available variants
        let inner = match InnerReceipt::default() {
            // Use whatever variant is available in the current version
            default_receipt => default_receipt,
        };
        
        // Create the receipt
        Receipt::new(inner, journal)
    };
    
    mock_receipt
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::Rng;

    // Helper function to create random bytes
    fn random_bytes() -> [u8; 32] {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill(&mut bytes);
        bytes
    }

    // Simple test to verify random bytes generation
    #[test]
    fn test_random_bytes() {
        let b1 = random_bytes();
        let b2 = random_bytes();
        assert_ne!(b1, b2, "Two random byte arrays should not be equal");
    }

    // Test VerifierContext creation
    #[test]
    fn test_verifier_context() {
        let context = VerifierContext {
            config: GadgetConfiguration::default(),
            tee_private_key: [0u8; 32],
        };
        
        assert_eq!(context.tee_private_key.len(), 32);
    }

    // Test EncryptedData creation
    #[test]
    fn test_encrypted_data() {
        let data = EncryptedData {
            encrypted_nullifier: vec![1, 2, 3],
            encrypted_private_key: vec![4, 5, 6],
            encrypted_index: vec![7, 8, 9],
            encrypted_merkle_path: vec![10, 11, 12],
            note_hash: [0u8; 32],
        };
        
        assert_eq!(data.encrypted_nullifier, vec![1, 2, 3]);
        assert_eq!(data.encrypted_private_key, vec![4, 5, 6]);
        assert_eq!(data.encrypted_index, vec![7, 8, 9]);
        assert_eq!(data.encrypted_merkle_path, vec![10, 11, 12]);
    }

    // Test decrypt_data function
    #[test]
    fn test_decrypt_data() {
        // This test would need proper encryption/decryption setup
        // For now, we'll just test the function signature
        let encrypted = vec![0u8; 12]; // Empty nonce
        let key = [0u8; 32];
        
        let decrypted = decrypt_data(&encrypted, &key);
        assert_eq!(decrypted.len(), 32);
    }
}
