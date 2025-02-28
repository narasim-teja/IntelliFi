import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

export interface SpendProofInput {
    walletAddress: Buffer;  // 20 bytes
    amount: bigint;
    merkleProof: {
        path: Buffer[];     // Array of 32 byte buffers
        indices: boolean[]; // Direction for each level
    };
    merkleRoot: Buffer;    // 32 bytes
}

export interface SpendProof {
    receipt: Buffer;       // RISC Zero proof receipt
    merkleRoot: Buffer;    // 32 bytes
    nullifier: Buffer;     // 32 bytes
    amount: bigint;
}

export class RiscZeroProver {
    private proverPath: string;
    
    constructor() {
        // Path to the RISC Zero prover binary
        this.proverPath = path.resolve(__dirname, '../../../../risc0/privacy-zkp/target/release/host');
    }
    
    public async initialize(): Promise<void> {
        // Build the prover if needed
        try {
            await promisify(spawn)('cargo', ['build', '--release'], {
                cwd: path.resolve(__dirname, '../../../../risc0/privacy-zkp'),
            });
        } catch (error) {
            throw new Error(`Failed to build RISC Zero prover: ${error}`);
        }
    }
    
    public async generateSpendProof(input: SpendProofInput): Promise<SpendProof> {
        // Convert input to JSON format expected by the prover
        const proofInput = {
            wallet_address: input.walletAddress.toString('hex'),
            amount: input.amount.toString(),
            merkle_proof: {
                path: input.merkleProof.path.map(p => p.toString('hex')),
                indices: input.merkleProof.indices,
            },
            merkle_root: input.merkleRoot.toString('hex'),
        };
        
        try {
            // Spawn the prover process
            const process = spawn(this.proverPath, ['prove'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            
            // Write input to stdin
            process.stdin.write(JSON.stringify(proofInput));
            process.stdin.end();
            
            // Collect output
            let output = '';
            process.stdout.on('data', (data) => {
                output += data;
            });
            
            // Wait for process to complete
            await new Promise((resolve, reject) => {
                process.on('close', (code) => {
                    if (code === 0) {
                        resolve(null);
                    } else {
                        reject(new Error(`Prover failed with code ${code}`));
                    }
                });
            });
            
            // Parse the proof output
            const proofOutput = JSON.parse(output);
            
            return {
                receipt: Buffer.from(proofOutput.receipt, 'hex'),
                merkleRoot: Buffer.from(proofOutput.merkle_root, 'hex'),
                nullifier: Buffer.from(proofOutput.nullifier, 'hex'),
                amount: BigInt(proofOutput.amount),
            };
            
        } catch (error) {
            throw new Error(`Failed to generate proof: ${error}`);
        }
    }
    
    public async verifySpendProof(proof: SpendProof): Promise<boolean> {
        try {
            // Convert proof to JSON format expected by the verifier
            const verifyInput = {
                receipt: proof.receipt.toString('hex'),
                merkle_root: proof.merkleRoot.toString('hex'),
                nullifier: proof.nullifier.toString('hex'),
                amount: proof.amount.toString(),
            };
            
            // Spawn the verifier process
            const process = spawn(this.proverPath, ['verify'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            
            // Write input to stdin
            process.stdin.write(JSON.stringify(verifyInput));
            process.stdin.end();
            
            // Wait for process to complete
            const exitCode = await new Promise<number>((resolve) => {
                process.on('close', resolve);
            });
            
            return exitCode === 0;
            
        } catch (error) {
            throw new Error(`Failed to verify proof: ${error}`);
        }
    }
    
    public async disconnect(): Promise<void> {
        // Cleanup any resources if needed
    }
} 