use privacy_zkp_methods::{GUEST_ELF, GUEST_ID};
use risc0_zkvm::{
    ExecutorEnv, Prover, Receipt, 
    serde::{from_slice, to_vec}
};
use sha2::{Digest, Sha256};
use curve25519_dalek::{ristretto::RistrettoPoint, scalar::Scalar};

// Re-export guest types for convenience
pub use privacy_zkp_methods::guest::{
    SpendVerificationInput, SpendNoteInput, 
    MerkleProof, NullifierData, AmountCommitment
};

#[derive(Debug)]
pub struct SpendProof {
    pub receipt: Receipt,
    pub merkle_root: [u8; 32],
    pub nullifier: [u8; 32],
    pub amount: u64,
}

pub struct ProofGenerator {
    prover: Prover,
}

impl ProofGenerator {
    pub fn new() -> Self {
        Self {
            prover: Prover::new(GUEST_ELF, GUEST_ID).unwrap()
        }
    }

    // Generate a proof for spending a note
    pub fn prove_spend(
        &self,
        wallet_address: [u8; 20],
        amount: u64,
        merkle_proof: MerkleProof,
        merkle_root: [u8; 32],
    ) -> Result<SpendProof, String> {
        // Generate nullifier data
        let nullifier_data = NullifierData {
            salt: rand::random(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        // Generate amount commitment
        let blinding_factor = Scalar::random(&mut rand::thread_rng());
        let amount_commitment = AmountCommitment {
            amount,
            blinding_factor,
            commitment: privacy_zkp_methods::guest::pedersen::PedersenCommitment::commit(
                amount,
                &blinding_factor,
            ),
        };

        // Generate nullifier
        let mut hasher = Sha256::new();
        hasher.update(&wallet_address);
        hasher.update(&nullifier_data.salt);
        hasher.update(&nullifier_data.timestamp.to_be_bytes());
        let nullifier = hasher.finalize().into();

        // Create spend note
        let spend_note = SpendNoteInput {
            wallet_address,
            nullifier,
            amount_commitment,
            nullifier_data,
        };

        // Create verification input
        let input = SpendVerificationInput {
            spend_note,
            merkle_proof,
            merkle_root,
            expected_amount: amount,
        };

        // Create the executor environment
        let env = ExecutorEnv::builder()
            .add_input(&to_vec(&input).unwrap())
            .build()
            .unwrap();

        // Generate the proof
        let receipt = self.prover.prove(env).map_err(|e| e.to_string())?;

        Ok(SpendProof {
            receipt,
            merkle_root,
            nullifier,
            amount,
        })
    }
}

pub struct ProofVerifier;

impl ProofVerifier {
    // Verify a spend proof
    pub fn verify_spend(proof: &SpendProof) -> Result<bool, String> {
        // Verify the RISC Zero proof
        proof.receipt.verify(GUEST_ID).map_err(|e| e.to_string())?;

        // Get the public outputs
        let journal = proof.receipt.journal.as_ref().ok_or("No journal found")?;
        
        // Verify the committed values match what we expect
        let committed_root: [u8; 32] = from_slice(&journal[0..32]).unwrap();
        let committed_nullifier: [u8; 32] = from_slice(&journal[32..64]).unwrap();
        let committed_amount: u64 = from_slice(&journal[64..72]).unwrap();

        if committed_root != proof.merkle_root {
            return Ok(false);
        }
        if committed_nullifier != proof.nullifier {
            return Ok(false);
        }
        if committed_amount != proof.amount {
            return Ok(false);
        }

        Ok(true)
    }
} 