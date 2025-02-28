use drew_v::FaceVerifier;
use ethers::types::{H256, U256, Address};
use ethers::prelude::*;
use std::str::FromStr;

#[tokio::test]
async fn test_face_verifier_initialization() {
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy Merkle Tree first
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Deploy Face Verifier
    let contract = FaceVerifier::deploy(client, merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Verify the Merkle Tree address is set correctly
    let merkle_tree_addr = contract.merkle_tree().call().await.unwrap();
    assert_eq!(merkle_tree_addr, merkle_tree.address());
}

#[tokio::test]
async fn test_commitment_creation() {
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy contracts
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    let contract = FaceVerifier::deploy(client.clone(), merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create a test nullifier
    let nullifier = H256::random();
    
    // Create commitment
    let tx = contract.create_commitment(nullifier).send().await.unwrap();
    let receipt = tx.await.unwrap();
    assert!(receipt.status.unwrap().is_success());

    // Verify commitment was created by checking for event
    let events = contract.commitment_created_filter().from_block(0u64).query().await.unwrap();
    assert_eq!(events.len(), 1);
}

#[tokio::test]
async fn test_nullifier_usage() {
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy contracts
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    let contract = FaceVerifier::deploy(client.clone(), merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create and use a nullifier
    let nullifier_hash = H256::random();
    let tx = contract.use_nullifier(nullifier_hash).send().await.unwrap();
    let receipt = tx.await.unwrap();
    assert!(receipt.status.unwrap().is_success());

    // Verify nullifier event was emitted
    let events = contract.nullifier_used_filter().from_block(0u64).query().await.unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].nullifier_hash, nullifier_hash);
}

#[tokio::test]
async fn test_root_verification() {
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy contracts
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    let contract = FaceVerifier::deploy(client.clone(), merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Get current root
    let root = contract.get_current_root().call().await.unwrap();
    
    // Verify root is known
    let is_known = contract.is_known_root(root).call().await.unwrap();
    assert!(is_known);
} 