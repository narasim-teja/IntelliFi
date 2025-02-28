import { generateNullifier, verifyNullifier } from './nullifier';
import { SpendNoteMerkleTree } from './merkle';
import { NullifierData, SpendNote, PrivacyConfig } from './types';
import { ProofGenerator, ProofVerifier, SpendProof } from './zkp';
import { ContractManager } from './contract';
import { SpendNoteLink } from './link';
import { ClaimService } from './link/claim-service';
import { ethers } from 'ethers';

export class PrivacyManager {
    public merkleTree: SpendNoteMerkleTree;
    private config: PrivacyConfig;
    private proofGenerator: ProofGenerator;
    private contractManager: ContractManager;
    private claimService: ClaimService;
    
    constructor(config: Partial<PrivacyConfig> = {}) {
        this.config = {
            merkleTreeDepth: config.merkleTreeDepth || 20,
            defaultAmount: config.defaultAmount || '0x0000000000000000000000000000000000000000000000000016345785D8A0000' // 0.1 ETH in hex
        };
        
        this.merkleTree = new SpendNoteMerkleTree();
        this.proofGenerator = new ProofGenerator();
        this.contractManager = new ContractManager();
        this.claimService = new ClaimService();
    }
    
    public async initialize(): Promise<void> {
        await this.merkleTree.initialize();
        
        // Sync the Merkle root with the contract
        await this.syncMerkleRoot();
    }
    
    // Sync the Merkle root with the contract
    private async syncMerkleRoot(): Promise<void> {
        try {
            const currentRoot = this.getMerkleRoot();
            const contractRoot = await this.contractManager.getMerkleRoot();
            
            // If the roots are different, update the contract
            if (currentRoot !== contractRoot) {
                await this.contractManager.updateMerkleRoot(currentRoot);
                console.log('Merkle root synced with contract');
            }
        } catch (error) {
            console.error('Error syncing Merkle root:', error);
        }
    }
    
    // Generate a new spend note for a wallet with ZK proof and submit to contract
    public async generateSpendNote(walletAddress: string): Promise<{
        spendNote: SpendNote;
        nullifierData: NullifierData;
        leafHash: string;
        proof: SpendProof;
        txHash: string;
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
        
        // Get merkle proof for the note
        const merkleProof = this.merkleTree.getProof(leafHash);
        
        // Generate ZK proof
        const proof = await this.proofGenerator.prove_spend(
            Buffer.from(walletAddress.slice(2), 'hex'),
            BigInt(this.config.defaultAmount),
            {
                path: merkleProof.map(p => Buffer.from(p.slice(2), 'hex')),
                indices: merkleProof.map((_, i) => i % 2 === 0) // Example indices, should match your tree logic
            },
            Buffer.from(this.getMerkleRoot().slice(2), 'hex')
        );
        
        // Submit to contract
        const { txHash } = await this.contractManager.createSpendNote(
            walletAddress,
            nullifierData,
            ethers.formatEther(BigInt(this.config.defaultAmount).toString()) // Convert the hex amount to ETH
        );
        
        // Update the Merkle root in the contract
        await this.syncMerkleRoot();
        
        return {
            spendNote,
            nullifierData,
            leafHash,
            proof,
            txHash
        };
    }
    
    // Generate a shareable link for a spend note
    public async generateSpendNoteLink(walletAddress: string, expiresInMinutes: number = 60): Promise<{
        link: string;
        noteHash: string;
        nullifierData: NullifierData;
    }> {
        // First, generate a spend note
        const { nullifierData, leafHash } = await this.generateSpendNote(walletAddress);
        
        // Get the merkle proof
        const merkleProof = this.merkleTree.getProof(leafHash);
        
        // Calculate the note hash (same as in ContractManager.createSpendNote)
        const walletAddressBytes = Buffer.from(walletAddress.slice(2), 'hex');
        const nullifierBytes = Buffer.from(nullifierData.nullifier.slice(2), 'hex');
        const combinedData = Buffer.concat([walletAddressBytes, nullifierBytes]);
        const { ethers } = await import('ethers');
        const noteHash = ethers.keccak256(combinedData);
        
        // Generate the link
        const link = SpendNoteLink.generateLink(
            noteHash,
            nullifierData,
            merkleProof,
            expiresInMinutes
        );
        
        return {
            link,
            noteHash,
            nullifierData
        };
    }
    
    // Claim a spend note using a signature from the recipient
    public async claimSpendNote(
        encodedData: string,
        signature: string,
        recipientAddress: string
    ): Promise<{
        success: boolean;
        message: string;
        txHash?: string;
    }> {
        return await this.claimService.claimSpendNote(
            encodedData,
            signature,
            recipientAddress
        );
    }
    
    // Get information about a spend note from a link
    public async getSpendNoteInfo(encodedData: string): Promise<{
        isValid: boolean;
        noteHash?: string;
        amount?: string;
        isSpent?: boolean;
        error?: string;
    }> {
        return await this.claimService.getSpendNoteInfo(encodedData);
    }
    
    // Spend a note by providing the nullifier and recipient
    public async spendNote(
        noteHash: string,
        nullifier: string,
        recipient: string
    ): Promise<string> {
        // Check if nullifier has been spent
        const isSpent = await this.contractManager.isNullifierSpent(nullifier);
        if (isSpent) {
            throw new Error('Nullifier has already been spent');
        }
        
        // Get Merkle proof
        const merkleProof = this.merkleTree.getProof(noteHash);
        
        // Spend the note on the contract
        return await this.contractManager.spendNote(
            noteHash,
            nullifier,
            recipient,
            merkleProof
        );
    }
    
    // Verify a spend note exists and hasn't been spent, including ZK proof
    public async verifySpendNote(
        leafHash: string,
        proof: SpendProof,
        nullifier: string,
        encryptedNullifier: string
    ): Promise<boolean> {
        // Verify nullifier
        const isValidNullifier = await verifyNullifier(nullifier, encryptedNullifier);
        if (!isValidNullifier) {
            return false;
        }
        
        // Check if nullifier has been spent on the contract
        const isSpent = await this.contractManager.isNullifierSpent(nullifier);
        if (isSpent) {
            return false;
        }
        
        // Verify ZK proof
        const isValidProof = await ProofVerifier.verify_spend(proof);
        if (!isValidProof) {
            return false;
        }
        
        // Verify merkle proof
        const merkleProof = this.merkleTree.getProof(leafHash);
        return this.merkleTree.verifyLeaf(leafHash, merkleProof);
    }
    
    // Get the current merkle root
    public getMerkleRoot(): string {
        return this.merkleTree.getRoot();
    }
    
    // Get all spend notes
    public getSpendNotes(): SpendNote[] {
        return this.merkleTree.getLeaves().map(leaf => leaf.spendNote);
    }
    
    // Get a spend note from the contract
    public async getContractSpendNote(noteHash: string): Promise<{
        noteHash: string;
        amount: string;
        spent: boolean;
        timestamp: number;
    }> {
        return await this.contractManager.getSpendNote(noteHash);
    }
    
    // Get the total number of spend notes from the contract
    public async getTotalContractSpendNotes(): Promise<number> {
        return await this.contractManager.getTotalSpendNotes();
    }
}

// Export types
export type { NullifierData, SpendNote, PrivacyConfig, MerkleLeaf } from './types';
export type { SpendProof } from './zkp';
export { ContractManager } from './contract';
export { SpendNoteLink } from './link';
export { ClaimService } from './link/claim-service';
