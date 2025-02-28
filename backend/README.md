# Privacy Backend with ZK Proofs

This project implements a privacy layer using zero-knowledge proofs using RISC Zero.

## Project Structure

- `src/privacy/` - Main privacy module
  - `index.ts` - Main PrivacyManager class
  - `nullifier/` - Nullifier generation and verification
  - `merkle/` - Merkle tree implementation
  - `zkp/` - Zero-knowledge proof integration
    - `index.ts` - TypeScript interface
    - `native/` - Native Rust implementation 

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
npm run prisma:generate
npm run prisma:migrate
```

## Testing

To run the tests with the mock ZK proof implementation:
```bash
npm test
```

## Building the Native Module

To build the native module:

1. Install Rust and Cargo:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install the NAPI CLI:
```bash
npm install -g @napi-rs/cli
```

3. Build the native module:
```bash
npm run build:zkp
```


## Architecture

1. **PrivacyManager**: Main class that coordinates nullifier generation, Merkle tree operations, and ZK proofs
2. **Nullifier**: Generates and verifies nullifiers to prevent double-spending
3. **Merkle Tree**: Maintains a tree of spend notes for efficient verification
4. **ZK Proofs**: Provides zero-knowledge proofs for privacy-preserving verification
