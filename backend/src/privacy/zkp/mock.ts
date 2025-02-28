import { Buffer } from 'buffer';
import { MerkleProof, SpendProof } from './index';
import crypto from 'crypto';

/**
 * Mock implementation of the ProofGenerator for testing
 * This avoids the need to build the native module during development
 */
export class MockProofGenerator {
    constructor() {
        console.log('Using mock proof generator for testing');
    }

    async prove_spend(
        wallet_address: Buffer,
        amount: bigint,
        merkle_proof: MerkleProof,
        merkle_root: Buffer
    ): Promise<SpendProof> {
        // Create a mock receipt (in production this would be a real ZK proof)
        const mockReceipt = Buffer.from(crypto.randomBytes(128));
        
        // Create a mock nullifier based on the wallet address and amount
        const nullifierData = Buffer.concat([
            wallet_address,
            Buffer.from(amount.toString(16).padStart(16, '0'), 'hex')
        ]);
        const nullifier = Buffer.from(crypto.createHash('sha256').update(nullifierData).digest());
        
        return {
            receipt: mockReceipt,
            merkle_root: merkle_root,
            nullifier: nullifier,
            amount: amount
        };
    }
}

/**
 * Mock implementation of the ProofVerifier for testing
 */
export class MockProofVerifier {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static async verify_spend(proof: SpendProof): Promise<boolean> {
        // In a real implementation, this would verify the ZK proof
        // For testing, we'll just return true
        return true;
    }
} 