import { PrivacyManager, SpendNoteLink } from './index';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testLinkGeneration() {
    try {
        console.log('Starting link generation test...');
        
        // Get the wallet address from the private key
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('PRIVATE_KEY environment variable is not set');
        }
        
        // Create a wallet instance to get the address
        const { ethers } = await import('ethers');
        const wallet = new ethers.Wallet(privateKey);
        const senderAddress = wallet.address;
        
        console.log(`Using sender address: ${senderAddress}`);
        
        // Initialize privacy manager
        const privacyManager = new PrivacyManager();
        await privacyManager.initialize();
        console.log('Privacy manager initialized');
        
        // Generate a spend note link
        console.log('Generating spend note link...');
        const { link, noteHash, nullifierData } = await privacyManager.generateSpendNoteLink(senderAddress, 60);
        
        console.log('Spend note link generated:');
        console.log(link);
        console.log('Note hash:', noteHash);
        console.log('Nullifier:', nullifierData.nullifier);
        console.log('Encrypted nullifier:', nullifierData.encryptedNullifier);
        
        // Extract the encoded data from the link
        const encodedData = link.split('claim?data=')[1];
        console.log('Encoded data length:', encodedData.length);
        
        try {
            // Try to decode the data manually to see what's happening
            const decodedData = JSON.parse(Buffer.from(encodedData, 'base64url').toString());
            console.log('Manually decoded data:', decodedData);
        } catch (error) {
            console.error('Error manually decoding data:', error);
        }
        
        // Get information about the spend note
        console.log('\nGetting spend note info from link...');
        const noteInfo = await privacyManager.getSpendNoteInfo(encodedData);
        console.log('Spend note info:', noteInfo);
        
        // Mock a recipient wallet for testing
        const recipientWallet = ethers.Wallet.createRandom();
        const recipientAddress = recipientWallet.address;
        console.log(`\nRecipient address: ${recipientAddress}`);
        
        // Decode the link data
        const linkData = SpendNoteLink.verifyLink(encodedData);
        if (!linkData.isValid || !linkData.data) {
            throw new Error('Invalid link data');
        }
        
        // Create a message for the recipient to sign
        const message = `I, ${recipientAddress}, am claiming a spend note with hash ${linkData.data.noteHash} and nullifier ${linkData.data.nullifier}. Timestamp: ${linkData.data.timestamp}`;
        console.log('\nMessage to sign:', message);
        
        // Sign the message with the recipient's wallet
        const signature = await recipientWallet.signMessage(message);
        console.log('Signature:', signature);
        
        // Claim the spend note
        console.log('\nClaiming the spend note...');
        const claimResult = await privacyManager.claimSpendNote(
            encodedData,
            signature,
            recipientAddress
        );
        
        console.log('Claim result:', claimResult);
        
        // Check if the nullifier is now spent
        // Get the note info again to check if it's spent
        const updatedNoteInfo = await privacyManager.getSpendNoteInfo(encodedData);
        console.log(`Is nullifier now spent: ${updatedNoteInfo.isSpent}`);
        
        console.log('\nLink generation test completed successfully');
    } catch (error) {
        console.error('Error in link generation test:', error);
    }
}

// Run the test
testLinkGeneration().catch(console.error); 