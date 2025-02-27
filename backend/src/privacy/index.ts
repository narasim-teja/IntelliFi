import { generateNullifier, verifyNullifier } from './nullifier';
import { SpendNoteMerkleTree } from './merkle';
import { NullifierData, SpendNote, PrivacyConfig } from './types';

export class PrivacyManager {
    public merkleTree: SpendNoteMerkleTree;
    private config: PrivacyConfig;
    
    constructor(config: Partial<PrivacyConfig> = {}) {
        this.config = {
            merkleTreeDepth: config.merkleTreeDepth || 20,
            defaultAmount: config.defaultAmount || '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' // 1 ETH in hex
        };
        
        this.merkleTree = new SpendNoteMerkleTree();
    }
    
    public async initialize(): Promise<void> {
        await this.merkleTree.initialize();
    }
    
    // Generate a new spend note for a wallet
    public async generateSpendNote(walletAddress: string): Promise<{
        spendNote: SpendNote;
        nullifierData: NullifierData;
        leafHash: string;
    }> {
        // Generate nullifier
        const nullifierData = await generateNullifier(walletAddress);
        
        // Create spend note
        const spendNote: SpendNote = {
            walletAddress,
            nullifier: nullifierData.nullifier,
            amount: this.config.defaultAmount,
            timestamp: nullifierData.timestamp
        };
        
        // Add to merkle tree
        const leafHash = await this.merkleTree.addSpendNote(spendNote);
        
        return {
            spendNote,
            nullifierData,
            leafHash
        };
    }
    
    // Verify a spend note exists and hasn't been spent
    public async verifySpendNote(
        leafHash: string,
        proof: string[],
        nullifier: string,
        encryptedNullifier: string
    ): Promise<boolean> {
        // Verify nullifier
        const isValidNullifier = await verifyNullifier(nullifier, encryptedNullifier);
        if (!isValidNullifier) {
            return false;
        }
        
        // Verify merkle proof
        return this.merkleTree.verifyLeaf(leafHash, proof);
    }
    
    // Get the current merkle root
    public getMerkleRoot(): string {
        return this.merkleTree.getRoot();
    }
    
    // Get all spend notes
    public getSpendNotes(): SpendNote[] {
        return this.merkleTree.getLeaves().map(leaf => leaf.spendNote);
    }
}

// Export types
export type { NullifierData, SpendNote, PrivacyConfig, MerkleLeaf } from './types';
