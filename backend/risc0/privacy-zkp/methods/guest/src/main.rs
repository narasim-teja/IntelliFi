#![no_main]
use risc0_zkvm::guest::env;
use sha2::{Digest, Sha256};

mod types;
mod pedersen;
use types::{SpendVerificationInput, SpendNoteInput, MerkleProof, NullifierData, AmountCommitment};
use pedersen::{PedersenCommitment, G, H};

risc0_zkvm::guest::entry!(main);

// Verify the merkle proof
pub fn verify_merkle_proof(leaf: &[u8], proof: &MerkleProof, root: &[u8; 32]) -> bool {
    let mut current = leaf.to_vec();
    
    for (i, sibling) in proof.path.iter().enumerate() {
        let mut hasher = Sha256::new();
        if proof.indices[i] {
            hasher.update(&current);
            hasher.update(sibling);
        } else {
            hasher.update(sibling);
            hasher.update(&current);
        }
        current = hasher.finalize().to_vec();
    }
    
    current.as_slice() == root
}

// Verify nullifier was correctly generated
pub fn verify_nullifier(wallet_address: &[u8; 20], nullifier_data: &NullifierData, expected_nullifier: &[u8; 32]) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(wallet_address);
    hasher.update(&nullifier_data.salt);
    hasher.update(&nullifier_data.timestamp.to_be_bytes());
    let computed_nullifier = hasher.finalize();
    computed_nullifier.as_slice() == expected_nullifier
}

// Verify amount commitment using Pedersen commitment scheme
pub fn verify_amount_commitment(commitment: &AmountCommitment, expected_amount: u64) -> bool {
    // Reconstruct the commitment using the Pedersen scheme
    let expected = PedersenCommitment::commit(
        expected_amount,
        &commitment.blinding_factor
    );
    
    // Verify the commitment matches
    expected == commitment.commitment
}

// Compute leaf hash for merkle tree
pub fn compute_leaf_hash(note: &SpendNoteInput) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(&note.wallet_address);
    hasher.update(&note.nullifier);
    
    // Hash the Pedersen commitment components
    hasher.update(&note.amount_commitment.commitment.compress().to_bytes());
    hasher.update(&note.amount_commitment.blinding_factor.to_bytes());
    
    // Hash nullifier data
    hasher.update(&note.nullifier_data.salt);
    hasher.update(&note.nullifier_data.timestamp.to_be_bytes());
    
    hasher.finalize().to_vec()
}

pub fn main() {
    // Read the input
    let input: SpendVerificationInput = env::read();
    
    // 1. Verify the nullifier was correctly generated
    let is_nullifier_valid = verify_nullifier(
        &input.spend_note.wallet_address,
        &input.spend_note.nullifier_data,
        &input.spend_note.nullifier
    );
    if !is_nullifier_valid {
        panic!("Invalid nullifier");
    }
    
    // 2. Verify the amount commitment using Pedersen commitment scheme
    let is_amount_valid = verify_amount_commitment(
        &input.spend_note.amount_commitment,
        input.expected_amount
    );
    if !is_amount_valid {
        panic!("Invalid amount commitment");
    }
    
    // 3. Verify the merkle proof (proves note exists and hasn't been spent)
    let leaf_hash = compute_leaf_hash(&input.spend_note);
    let is_proof_valid = verify_merkle_proof(
        &leaf_hash,
        &input.merkle_proof,
        &input.merkle_root
    );
    if !is_proof_valid {
        panic!("Invalid merkle proof");
    }
    
    // Commit public inputs:
    // - Merkle root (to verify against on-chain state)
    // - Nullifier (to prevent double-spending)
    // - Expected amount (to verify transfer amount)
    env::commit(&input.merkle_root);
    env::commit(&input.spend_note.nullifier);
    env::commit(&input.expected_amount);
}
