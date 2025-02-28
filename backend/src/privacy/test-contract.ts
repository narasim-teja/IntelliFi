import { PrivacyManager, ContractManager } from './index';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testContractIntegration() {
    try {
        console.log('Starting contract integration test...');
        
        // Initialize contract manager
        const contractManager = new ContractManager();
        
        // Get the wallet address from the private key
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('PRIVATE_KEY environment variable is not set');
        }
        
        // Create a wallet instance to get the address
        const { ethers } = await import('ethers');
        const wallet = new ethers.Wallet(privateKey);
        const walletAddress = wallet.address;
        
        console.log(`Using wallet address: ${walletAddress}`);
        
        // Check if the wallet is already registered
        const isRegistered = await contractManager.isRegistered(walletAddress);
        console.log(`Is wallet registered: ${isRegistered}`);
        
        // If not registered, register the wallet
        if (!isRegistered) {
            console.log('Registering wallet...');
            
            // Generate a dummy face hash
            const faceHash = '0x' + bytesToHex(sha256('dummy-face-data'));
            
            // Use a dummy IPFS hash
            const ipfsHash = 'QmDummyIpfsHash';
            
            // Generate a dummy public key (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
            const dummyPublicKey = '0x04' + '00'.repeat(64);
            
            // Register the wallet
            const txHash = await contractManager.register(faceHash, ipfsHash, dummyPublicKey);
            console.log(`Wallet registered with transaction hash: ${txHash}`);
        }
        
        // Initialize privacy manager
        const privacyManager = new PrivacyManager();
        await privacyManager.initialize();
        console.log('Privacy manager initialized');
        
        // Use the same wallet address for the test
        const testWalletAddress = walletAddress;
        
        // 1. Generate a spend note
        console.log(`Generating spend note for wallet: ${testWalletAddress}`);
        const { nullifierData, txHash } = await privacyManager.generateSpendNote(testWalletAddress);
        console.log('Spend note generated successfully');
        console.log('Transaction hash:', txHash);
        console.log('Nullifier:', nullifierData.nullifier);
        console.log('Encrypted nullifier:', nullifierData.encryptedNullifier);
        
        // 2. Create the note hash directly (same as in ContractManager.createSpendNote)
        const walletAddressBytes = Buffer.from(testWalletAddress.slice(2), 'hex');
        const nullifierBytes = Buffer.from(nullifierData.nullifier.slice(2), 'hex');
        const combinedData = Buffer.concat([walletAddressBytes, nullifierBytes]);
        const noteHash = ethers.keccak256(combinedData);
        
        console.log(`Getting spend note from contract with hash: ${noteHash}`);
        const contractNote = await contractManager.getSpendNote(noteHash);
        console.log('Contract note:', contractNote);
        
        // 3. Check if nullifier is spent
        const isSpent = await contractManager.isNullifierSpent(nullifierData.nullifier);
        console.log(`Is nullifier spent: ${isSpent}`);
        
        // 4. Get total number of spend notes
        const totalNotes = await contractManager.getTotalSpendNotes();
        console.log(`Total spend notes: ${totalNotes}`);
        
        // 5. Get current Merkle root
        const merkleRoot = await contractManager.getMerkleRoot();
        console.log(`Current Merkle root: ${merkleRoot}`);
        
        // 6. Spend the note (optional - uncomment to test spending)
        // This is commented out by default to avoid spending notes in tests
        /*
        console.log('Spending the note...');
        const recipient = walletAddress; // Send back to the same wallet for testing
        const spendTxHash = await privacyManager.spendNote(
            noteHash,
            nullifierData.nullifier,
            recipient
        );
        console.log(`Note spent with transaction hash: ${spendTxHash}`);
        
        // Verify the note is now spent
        const updatedContractNote = await contractManager.getSpendNote(noteHash);
        console.log('Updated contract note:', updatedContractNote);
        
        const isNowSpent = await contractManager.isNullifierSpent(nullifierData.nullifier);
        console.log(`Is nullifier now spent: ${isNowSpent}`);
        */
        
        console.log('Contract integration test completed successfully');
    } catch (error) {
        console.error('Error in contract integration test:', error);
    }
}

// Run the test
testContractIntegration().catch(console.error); 