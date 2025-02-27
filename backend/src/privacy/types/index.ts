export interface NullifierData {
  nullifier: string;
  encryptedNullifier: string;
  timestamp: number;
}

export interface SpendNote {
  walletAddress: string;
  nullifier: string;
  amount: string;
  timestamp: number;
}

export interface MerkleLeaf {
  hash: string;
  spendNote: SpendNote;
}

export interface PrivacyConfig {
  merkleTreeDepth: number;
  defaultAmount: string;
}
