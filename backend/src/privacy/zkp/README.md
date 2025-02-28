# Zero-Knowledge Proof System

This module provides a zero-knowledge proof system for privacy-preserving transactions using RISC Zero.

## Architecture

The system consists of:

1. **TypeScript Interface** (`index.ts`): Provides a consistent API for both development and production
2. **Mock Implementation** (`mock.ts`): Used during development for faster testing
3. **Native Module** (`native/`): Rust implementation for production

## Development vs Production

- In development, the system uses a mock implementation that doesn't require building the native module
- In production, the system tries to load the native Rust implementation, but falls back to the mock implementation if the native module is not available

## Building the Native Module

To build the native module:

1. Make sure you have Rust and Cargo installed:
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

## Testing

To test with the mock implementation:
```bash
npx ts-node src/privacy/test.ts
```

To test with the native implementation (after building):
```bash
npm run test:zkp
```

## Implementation Details

### Mock Implementation

The current implementation uses a mock version of the ZK proof system that:
1. Generates random receipts for proofs
2. Always returns true for verification
3. Provides the same API as the real implementation

### Future RISC Zero Implementation

In the future, a full RISC Zero implementation could be added that:
1. Verifies the nullifier was correctly generated
2. Validates the amount commitment
3. Verifies the Merkle proof is valid

### Pedersen Commitments

The system uses Pedersen commitments for hiding amounts while allowing verification:
- `commitment = g^amount * h^r`
- Where `g` and `h` are generator points on an elliptic curve
- `r` is a random blinding factor

### Nullifier Generation

Nullifiers are generated as:
```
nullifier = SHA256(wallet_address || salt || timestamp)
```

This ensures each spend note has a unique nullifier that can be verified. 