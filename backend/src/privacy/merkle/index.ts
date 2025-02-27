import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { MerkleLeaf, SpendNote } from '../types';
import { MerkleTreeDB } from './db';

export class SpendNoteMerkleTree {
    private tree: MerkleTree;
    private leaves: MerkleLeaf[] = [];
    private db: MerkleTreeDB;
    
    constructor() {
        this.tree = new MerkleTree([], (data: Buffer) => {
            const hash = sha256(data);
            return Buffer.from(hash);
        }, {
            hashLeaves: false,
            sortPairs: true,
        });
        
        this.db = new MerkleTreeDB();
    }
    
    public async initialize(): Promise<void> {
        await this.initializeFromDB();
    }
    
    private async initializeFromDB(): Promise<void> {
        // Load existing leaves from DB
        this.leaves = await this.db.getAllSpendNotes();
        
        // Rebuild tree from leaves
        for (const leaf of this.leaves) {
            const leafData = SpendNoteMerkleTree.createLeafData(leaf.spendNote);
            this.tree.addLeaf(leafData, false);
        }
    }
    
    // Create leaf data from spend note
    private static createLeafData(spendNote: SpendNote): Buffer {
        const data = Buffer.concat([
            Buffer.from(spendNote.walletAddress.slice(2), 'hex'),
            Buffer.from(spendNote.nullifier.slice(2), 'hex'),
            Buffer.from(spendNote.amount.slice(2), 'hex'),
            Buffer.from(spendNote.timestamp.toString(16).padStart(16, '0'), 'hex')
        ]);
        return data;
    }
    
    // Add a new spend note to the tree
    public async addSpendNote(spendNote: SpendNote): Promise<string> {
        const leafData = SpendNoteMerkleTree.createLeafData(spendNote);
        const leafHash = '0x' + bytesToHex(sha256(leafData));
        
        const leaf: MerkleLeaf = {
            hash: leafHash,
            spendNote
        };
        
        this.leaves.push(leaf);
        this.tree.addLeaf(leafData, false);
        
        // Save to database
        await this.db.saveSpendNote(leaf);
        await this.db.saveMerkleRoot(this.getRoot());
        
        return leafHash;
    }
    
    // Get proof for a specific leaf
    public getProof(leafHash: string): string[] {
        const leaf = this.leaves.find(l => l.hash === leafHash);
        if (!leaf) {
            throw new Error('Leaf not found');
        }
        
        const leafData = SpendNoteMerkleTree.createLeafData(leaf.spendNote);
        const proof = this.tree.getProof(leafData);
        return proof.map(p => '0x' + p.data.toString('hex'));
    }
    
    // Verify if a leaf exists in the tree
    public verifyLeaf(leafHash: string, proof: string[]): boolean {
        const leaf = this.leaves.find(l => l.hash === leafHash);
        if (!leaf) {
            return false;
        }
        
        const leafData = SpendNoteMerkleTree.createLeafData(leaf.spendNote);
        const bufferProof = proof.map(p => Buffer.from(p.slice(2), 'hex'));
        
        return this.tree.verify(bufferProof, leafData, this.tree.getRoot());
    }
    
    // Get the current root of the tree
    public getRoot(): string {
        return '0x' + this.tree.getRoot().toString('hex');
    }
    
    // Get all leaves
    public getLeaves(): MerkleLeaf[] {
        return this.leaves;
    }
    
    // Cleanup database connection
    public async disconnect(): Promise<void> {
        await this.db.disconnect();
    }
}
