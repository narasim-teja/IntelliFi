use serde::{Deserialize, Serialize};
use curve25519_dalek::{ristretto::RistrettoPoint, scalar::Scalar};

#[derive(Debug, Serialize, Deserialize)]
pub struct NullifierData {
    pub salt: [u8; 32],            // Random salt used in nullifier generation
    pub timestamp: u64,            // Timestamp when nullifier was generated
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AmountCommitment {
    pub commitment: RistrettoPoint, // The Pedersen commitment
    pub amount: u64,               // Actual amount (will be hidden)
    pub blinding_factor: Scalar,   // Random scalar for the commitment
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpendNoteInput {
    pub wallet_address: [u8; 20],  // ETH address is 20 bytes
    pub nullifier: [u8; 32],       // SHA256 hash is 32 bytes
    pub amount_commitment: AmountCommitment,
    pub nullifier_data: NullifierData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerkleProof {
    pub path: Vec<[u8; 32]>,
    pub indices: Vec<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpendVerificationInput {
    pub spend_note: SpendNoteInput,
    pub merkle_proof: MerkleProof,
    pub merkle_root: [u8; 32],
    pub expected_amount: u64,      // Amount to verify against commitment
} 