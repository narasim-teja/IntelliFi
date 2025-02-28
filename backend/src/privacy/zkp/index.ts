import { Buffer } from 'buffer';
import { MockProofGenerator, MockProofVerifier } from './mock';
import * as fs from 'fs';
import * as path from 'path';

// Types that mirror the Rust types
export interface MerkleProof {
    path: Buffer[];
    indices: boolean[];
}

export interface NullifierData {
    salt: Buffer;
    timestamp: bigint;
}

export interface AmountCommitment {
    commitment: Buffer;  // Compressed RistrettoPoint
    amount: bigint;
    blinding_factor: Buffer;  // Scalar bytes
}

export interface SpendNoteInput {
    wallet_address: Buffer;
    nullifier: Buffer;
    amount_commitment: AmountCommitment;
    nullifier_data: NullifierData;
}

export interface SpendProof {
    receipt: Buffer;       // Serialized RISC Zero receipt
    merkle_root: Buffer;
    nullifier: Buffer;
    amount: bigint;
}

// Native module interfaces
interface NativeSpendProof {
    receipt: Buffer;
    merkle_root: Buffer;
    nullifier: Buffer;
    amount: number;
}

interface NativeProofGenerator {
    proveSpend: (
        wallet_address: Buffer,
        amount: number,
        merkle_proof: MerkleProof,
        merkle_root: Buffer
    ) => Promise<NativeSpendProof>;
}

interface NativeModule {
    ProofGenerator: new () => NativeProofGenerator;
    verifySpend: (proof: NativeSpendProof) => Promise<boolean>;
}

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

// Find the native module file
const findNativeModule = (): string | null => {
    // Possible paths where the native module might be located
    const possiblePaths = [
        path.join(__dirname, 'native', 'index.node'),
        path.join(__dirname, 'native', 'privacy-zkp-native.node'),
        path.join(__dirname, 'native', 'privacy_zkp_native.node')
    ];
    
    for (const modulePath of possiblePaths) {
        if (fs.existsSync(modulePath)) {
            return modulePath;
        }
    }
    
    return null;
};

// Dynamic import helper for the native module
const getNativeModule = async (): Promise<NativeModule | null> => {
    if (!isProduction) return null;
    
    try {
        // Find the native module
        const modulePath = findNativeModule();
        if (!modulePath) {
            console.warn('Native module file not found');
            return null;
        }
        
        // Use require() for native modules
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        const nativeModule = require(modulePath);
        return nativeModule as NativeModule;
    } catch (error) {
        // Log the error but return null to fall back to mock
        console.error('Error loading native module:', error);
        return null;
    }
};

// Interface to the RISC Zero proof system
export class ProofGenerator {
    private impl: MockProofGenerator | NativeProofGenerator;
    private nativeLoaded = false;
    private nativeLoading = false;

    constructor() {
        // Default to mock implementation
        this.impl = new MockProofGenerator();
        
        // Try to load native module if in production
        if (isProduction) {
            this.loadNativeModule().catch(err => {
                console.warn('Failed to load native module:', err);
            });
        } else {
            console.log('Using mock proof generator for development');
        }
    }

    private async loadNativeModule(): Promise<void> {
        if (this.nativeLoaded || this.nativeLoading) return;
        
        this.nativeLoading = true;
        try {
            const nativeModule = await getNativeModule();
            if (nativeModule) {
                this.impl = new nativeModule.ProofGenerator();
                this.nativeLoaded = true;
                console.log('Using native RISC Zero implementation');
            } else {
                console.warn('Native RISC Zero module not available, falling back to mock implementation');
            }
        } catch (error) {
            console.error('Error initializing native module:', error);
        } finally {
            this.nativeLoading = false;
        }
    }

    async prove_spend(
        wallet_address: Buffer,
        amount: bigint,
        merkle_proof: MerkleProof,
        merkle_root: Buffer
    ): Promise<SpendProof> {
        // If we're using the mock implementation, just pass through
        if (this.impl instanceof MockProofGenerator) {
            return await this.impl.prove_spend(
                wallet_address,
                amount,
                merkle_proof,
                merkle_root
            );
        } else {
            // If we're using the native implementation, convert bigint to number
            // This is a limitation of the native module
            const amountNumber = Number(amount);
            if (amountNumber > Number.MAX_SAFE_INTEGER) {
                throw new Error('Amount too large for native module');
            }
            
            const nativeProof = await (this.impl as NativeProofGenerator).proveSpend(
                wallet_address,
                amountNumber,
                merkle_proof,
                merkle_root
            );
            
            // Convert the amount back to bigint
            return {
                receipt: nativeProof.receipt,
                merkle_root: nativeProof.merkle_root,
                nullifier: nativeProof.nullifier,
                amount: BigInt(nativeProof.amount)
            };
        }
    }
}

export class ProofVerifier {
    static async verify_spend(proof: SpendProof): Promise<boolean> {
        if (isProduction) {
            try {
                const nativeModule = await getNativeModule();
                if (nativeModule) {
                    // Convert bigint to number for the native module
                    const nativeProof: NativeSpendProof = {
                        receipt: proof.receipt,
                        merkle_root: proof.merkle_root,
                        nullifier: proof.nullifier,
                        amount: Number(proof.amount)
                    };
                    
                    return await nativeModule.verifySpend(nativeProof);
                }
            } catch (error) {
                console.error('Error verifying with native module:', error);
            }
            
            console.warn('Native RISC Zero module not available, falling back to mock implementation');
        }
        
        // Fall back to mock implementation
        return await MockProofVerifier.verify_spend(proof);
    }
} 