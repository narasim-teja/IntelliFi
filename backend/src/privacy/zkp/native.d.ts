declare module './native' {
    import { SpendProof, MerkleProof } from './index';
    
    export class ProofGenerator {
        constructor();
        prove_spend(
            wallet_address: Buffer,
            amount: bigint,
            merkle_proof: MerkleProof,
            merkle_root: Buffer
        ): Promise<SpendProof>;
    }
    
    export function verify_spend(proof: SpendProof): Promise<boolean>;
} 