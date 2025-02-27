import { PrismaClient } from '@prisma/client';
import { MerkleLeaf } from '../types';

export class MerkleTreeDB {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    async saveSpendNote(leaf: MerkleLeaf): Promise<void> {
        await this.prisma.spendNote.create({
            data: {
                walletAddress: leaf.spendNote.walletAddress,
                nullifier: leaf.spendNote.nullifier,
                amount: leaf.spendNote.amount,
                timestamp: BigInt(leaf.spendNote.timestamp),
                leafHash: leaf.hash
            }
        });
    }

    async saveMerkleRoot(root: string): Promise<void> {
        await this.prisma.merkleRoot.create({
            data: {
                root,
                timestamp: BigInt(Date.now())
            }
        });
    }

    async getAllSpendNotes(): Promise<MerkleLeaf[]> {
        const notes = await this.prisma.spendNote.findMany({
            orderBy: { timestamp: 'asc' }
        });

        return notes.map(note => ({
            hash: note.leafHash,
            spendNote: {
                walletAddress: note.walletAddress,
                nullifier: note.nullifier,
                amount: note.amount,
                timestamp: Number(note.timestamp)
            }
        }));
    }

    async getLatestMerkleRoot(): Promise<string | null> {
        const root = await this.prisma.merkleRoot.findFirst({
            orderBy: { timestamp: 'desc' }
        });
        return root?.root || null;
    }

    async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
    }
} 