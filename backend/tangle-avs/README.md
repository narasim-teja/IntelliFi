# Tangle AVS for Privacy-Preserving Face Verification

This project implements a privacy-preserving face verification system using Tangle AVS (Actively Validated Services) with Trusted Execution Environment (TEE) and zero-knowledge proofs via RiscZero.

## System Architecture

The system consists of the following components:

1. **Smart Contract (FaceVerifier.sol)**: Manages user registrations, spend notes, and the Merkle tree of commitments.
2. **Tangle AVS**: Runs in a TEE environment to process encrypted data and generate zero-knowledge proofs.
3. **RiscZero ZK Prover**: Verifies Merkle proofs and generates zero-knowledge proofs.

## Workflow

The workflow follows these steps as shown in the diagram:

1. **User Registration**: Users register their face data and public key with the smart contract.
2. **Spend Note Creation**: Users create spend notes by depositing ETH into the contract.
3. **Commitment Creation**: When a user wants to spend a note, they create a commitment with encrypted data:
   - Encrypted nullifier
   - Encrypted private key
   - Encrypted index of spend note
   - Encrypted Merkle path
4. **TEE Processing**:
   - The AVS running in a TEE environment decrypts the data
   - Verifies the Merkle path using RiscZero
   - Generates a zero-knowledge proof
5. **Proof Verification**: The AVS submits the proof to the smart contract
6. **Fund Release**: If the proof is valid, the funds are released to the recipient

## Security Features

- **Privacy**: User data is encrypted and only decrypted inside the TEE
- **Double-Spend Prevention**: Nullifiers are used to prevent double-spending
- **Zero-Knowledge Proofs**: RiscZero is used to generate proofs without revealing sensitive data
- **Merkle Tree Verification**: Ensures that spend notes exist in the tree without revealing which one

## Setup and Configuration

### Environment Variables

Create a `.env` file with the following variables:

```
FACE_VERIFIER_ADDRESS=0x...
TEE_PRIVATE_KEY=... (optional, will be generated if not provided)
```

### Running the AVS

```bash
cargo build
cargo run
```

## Development

### Prerequisites

- Rust 1.81 or later
- Solidity 0.8.0 or later
- RiscZero toolchain

### Building

```bash
cargo build
```

### Testing

```bash
cargo test
```

## License

This project is licensed under either of

- Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

## 📬 Feedback and Contributions

We welcome feedback and contributions to improve this blueprint.
Please open an issue or submit a pull request on
our [GitHub repository](https://github.com/tangle-network/blueprint-template/issues).

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
