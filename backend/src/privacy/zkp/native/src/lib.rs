#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::convert::TryInto;
use sha2::{Sha256, Digest};
use rand::Rng;

#[napi(object)]
pub struct MerkleProof {
    pub path: Vec<Buffer>,
    pub indices: Vec<bool>,
}

#[napi(object)]
pub struct NullifierData {
    pub salt: Buffer,
    pub timestamp: i64,
}

#[napi(object)]
pub struct AmountCommitment {
    pub commitment: Buffer,
    pub amount: i64,
    pub blinding_factor: Buffer,
}

#[napi(object)]
pub struct SpendNoteInput {
    pub wallet_address: Buffer,
    pub nullifier: Buffer,
    pub amount_commitment: AmountCommitment,
    pub nullifier_data: NullifierData,
}

#[napi(object)]
pub struct SpendProof {
    pub receipt: Buffer,
    pub merkle_root: Buffer,
    pub nullifier: Buffer,
    pub amount: i64,
}

#[napi]
pub struct ProofGenerator {
    // Mock implementation
}

#[napi]
impl ProofGenerator {
    #[napi(constructor)]
    pub fn new() -> Self {
        ProofGenerator {}
    }

    #[napi(js_name = "proveSpend")]
    pub async fn prove_spend(
        &self,
        wallet_address: Buffer,
        amount: i64,
        merkle_proof: MerkleProof,
        merkle_root: Buffer,
    ) -> Result<SpendProof> {
        // Create a mock receipt (in production this would be a real ZK proof)
        let mut rng = rand::thread_rng();
        let mock_receipt: Vec<u8> = (0..128).map(|_| rng.gen()).collect();
        
        // Create a mock nullifier based on the wallet address and amount
        let mut hasher = Sha256::new();
        hasher.update(&wallet_address);
        hasher.update(amount.to_be_bytes());
        let nullifier = hasher.finalize();
        
        Ok(SpendProof {
            receipt: Buffer::from(mock_receipt),
            merkle_root,
            nullifier: Buffer::from(nullifier.to_vec()),
            amount,
        })
    }
}

#[napi(js_name = "verifySpend")]
pub async fn verify_spend(_proof: SpendProof) -> Result<bool> {
    // Mock implementation always returns true
    Ok(true)
} 