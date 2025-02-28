use drew_v::CommitmentMerkleTree;
use ethers::types::{H256, U256};
use ethers::prelude::*;

#[tokio::test]
async fn test_merkle_tree_initialization() {
    // Test initialization of Merkle tree
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    let contract = CommitmentMerkleTree::deploy(client, ())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Test initial root
    let root = contract.get_last_root().call().await.unwrap();
    assert_ne!(root, H256::zero());

    // Test zero value at different levels
    for i in 0..5 {
        let zero = contract.zeros(i).call().await.unwrap();
        assert_ne!(zero, H256::zero());
    }
}

#[tokio::test]
async fn test_commitment_insertion() {
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    let contract = CommitmentMerkleTree::deploy(client, ())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create a test commitment
    let commitment = H256::random();
    
    // Insert commitment
    let tx = contract.insert_commitment(commitment).send().await.unwrap();
    let receipt = tx.await.unwrap();
    assert!(receipt.status.unwrap().is_success());

    // Verify the commitment was inserted
    let new_root = contract.get_last_root().call().await.unwrap();
    assert!(contract.is_known_root_value(new_root).call().await.unwrap());
}

#[tokio::test]
async fn test_nullifier_marking() {
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    let contract = CommitmentMerkleTree::deploy(client, ())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create a test nullifier
    let nullifier = H256::random();
    
    // Mark nullifier as used
    let tx = contract.mark_nullifier_as_used(nullifier).send().await.unwrap();
    let receipt = tx.await.unwrap();
    assert!(receipt.status.unwrap().is_success());

    // Try to use the same nullifier again (should fail)
    let result = contract
        .mark_nullifier_as_used(nullifier)
        .send()
        .await;
    assert!(result.is_err());
} 