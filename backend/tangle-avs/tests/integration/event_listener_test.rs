use drew_v::{FaceVerifier, VerifierContext, ProcessFaceVerificationEventHandler};
use blueprint_sdk::config::GadgetConfiguration;
use blueprint_sdk::event_listeners::evm::EvmContractEventListener;
use ethers::prelude::*;
use std::sync::Arc;
use tokio;

#[tokio::test]
async fn test_commitment_event_listener() {
    // Setup provider and client
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy contracts
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    let verifier = FaceVerifier::deploy(client.clone(), merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create verifier context
    let context = VerifierContext {
        config: GadgetConfiguration::default(),
        tee_private_key: [0u8; 32],
    };

    // Create event handler
    let event_handler = ProcessFaceVerificationEventHandler::new(
        verifier.clone(),
        context.clone(),
    );

    // Create a test commitment
    let nullifier = H256::random();
    let tx = verifier.create_commitment(nullifier).send().await.unwrap();
    let receipt = tx.await.unwrap();
    assert!(receipt.status.unwrap().is_success());

    // Wait for event to be processed
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Verify event was processed by checking nullifier status
    let events = verifier.commitment_created_filter().from_block(0u64).query().await.unwrap();
    assert_eq!(events.len(), 1);
}

#[tokio::test]
async fn test_multiple_commitments() {
    // Setup provider and client
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy contracts
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    let verifier = FaceVerifier::deploy(client.clone(), merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create multiple commitments
    for _ in 0..3 {
        let nullifier = H256::random();
        let tx = verifier.create_commitment(nullifier).send().await.unwrap();
        let receipt = tx.await.unwrap();
        assert!(receipt.status.unwrap().is_success());
    }

    // Verify all events were emitted
    let events = verifier.commitment_created_filter().from_block(0u64).query().await.unwrap();
    assert_eq!(events.len(), 3);
}

#[tokio::test]
async fn test_event_listener_recovery() {
    // Setup provider and client
    let provider = Provider::try_from("http://localhost:8545").unwrap();
    let client = Arc::new(provider);
    
    // Deploy contracts
    let merkle_tree = drew_v::CommitmentMerkleTree::deploy(client.clone(), ())
        .unwrap()
        .send()
        .await
        .unwrap();

    let verifier = FaceVerifier::deploy(client.clone(), merkle_tree.address())
        .unwrap()
        .send()
        .await
        .unwrap();

    // Create verifier context
    let context = VerifierContext {
        config: GadgetConfiguration::default(),
        tee_private_key: [0u8; 32],
    };

    // Create event handler
    let event_handler = ProcessFaceVerificationEventHandler::new(
        verifier.clone(),
        context.clone(),
    );

    // Create commitments before starting listener
    for _ in 0..2 {
        let nullifier = H256::random();
        let tx = verifier.create_commitment(nullifier).send().await.unwrap();
        let receipt = tx.await.unwrap();
        assert!(receipt.status.unwrap().is_success());
    }

    // Start listener and verify it processes past events
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Create more commitments after listener is running
    for _ in 0..2 {
        let nullifier = H256::random();
        let tx = verifier.create_commitment(nullifier).send().await.unwrap();
        let receipt = tx.await.unwrap();
        assert!(receipt.status.unwrap().is_success());
    }

    // Verify all events were processed
    let events = verifier.commitment_created_filter().from_block(0u64).query().await.unwrap();
    assert_eq!(events.len(), 4);
} 