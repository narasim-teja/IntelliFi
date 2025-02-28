use host::{ProofGenerator, ProofVerifier, MerkleProof};
use sha2::{Digest, Sha256};

fn main() {
    // Example wallet address (20 bytes)
    let wallet_address = [1u8; 20];
    
    // Example amount
    let amount = 1_000_000; // 1 ETH in wei
    
    // Example merkle proof (simplified for demo)
    let merkle_proof = MerkleProof {
        path: vec![[0u8; 32], [1u8; 32], [2u8; 32]], // Example path
        indices: vec![true, false, true],             // Example indices
    };
    
    // Example merkle root
    let merkle_root = [42u8; 32];
    
    println!("Generating proof...");
    
    // Create proof generator
    let generator = ProofGenerator::new();
    
    // Generate the proof
    let proof = generator.prove_spend(
        wallet_address,
        amount,
        merkle_proof,
        merkle_root,
    ).expect("Failed to generate proof");
    
    println!("Proof generated successfully!");
    println!("Merkle root: 0x{}", hex::encode(proof.merkle_root));
    println!("Nullifier: 0x{}", hex::encode(proof.nullifier));
    println!("Amount: {}", proof.amount);
    
    println!("\nVerifying proof...");
    
    // Verify the proof
    match ProofVerifier::verify_spend(&proof) {
        Ok(true) => println!("Proof verified successfully!"),
        Ok(false) => println!("Proof verification failed!"),
        Err(e) => println!("Error verifying proof: {}", e),
    }
} 