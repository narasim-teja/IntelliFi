import { generateNullifier, verifyNullifier } from './nullifier';
import { PrivacyManager } from './index';

async function testNullifier() {
    console.log('Testing Nullifier Generation and Verification...');
    
    // Test wallet address (example)
    const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    
    try {
        // Test 1: Generate and verify a nullifier
        console.log('\nTest 1: Basic Nullifier Generation');
        const nullifierData = await generateNullifier(walletAddress);
        console.log('Generated Nullifier:', nullifierData.nullifier);
        console.log('Encrypted Nullifier:', nullifierData.encryptedNullifier);
        
        const isValid = await verifyNullifier(
            nullifierData.nullifier,
            nullifierData.encryptedNullifier
        );
        console.log('Verification Result:', isValid);
        
        // Test 2: Test the complete privacy manager flow
        console.log('\nTest 2: Privacy Manager Flow');
        const privacyManager = new PrivacyManager();
        await privacyManager.initialize();
        const result = await privacyManager.generateSpendNote(walletAddress);
        
        console.log('Generated Spend Note:', {
            walletAddress: result.spendNote.walletAddress,
            nullifier: result.spendNote.nullifier.slice(0, 20) + '...',
            amount: result.spendNote.amount,
            timestamp: new Date(result.spendNote.timestamp).toISOString()
        });
        
        console.log('Merkle Root:', privacyManager.getMerkleRoot());
        
        // Get proof and verify
        const proof = privacyManager.merkleTree.getProof(result.leafHash);
        const isSpendValid = await privacyManager.verifySpendNote(
            result.leafHash,
            proof,
            result.nullifierData.nullifier,
            result.nullifierData.encryptedNullifier
        );
        
        console.log('Spend Note Verification:', isSpendValid);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the tests
testNullifier().then(() => console.log('\nTests completed!')); 