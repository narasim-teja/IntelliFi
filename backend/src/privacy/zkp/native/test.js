const { ProofGenerator, verifySpend } = require('./index');

async function runTest() {
  try {
    console.log('Testing native RISC Zero module...');
    
    // Create a proof generator
    const generator = new ProofGenerator();
    console.log('Created ProofGenerator');
    
    // Create test data
    const walletAddress = Buffer.from('0x1234567890123456789012345678901234567890'.slice(2), 'hex');
    const amount = 100; // Use a regular number instead of BigInt
    const merkleRoot = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
    const merkleProof = {
      path: [
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ],
      indices: [false, true]
    };
    
    // Generate a proof
    console.log('Generating proof...');
    const proof = await generator.proveSpend(walletAddress, amount, merkleProof, merkleRoot);
    console.log('Generated proof:', proof);
    
    // Verify the proof
    console.log('Verifying proof...');
    const isValid = await verifySpend(proof);
    console.log('Proof verification result:', isValid);
    
    if (isValid) {
      console.log('✅ Test passed!');
    } else {
      console.log('❌ Test failed: Proof verification returned false');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTest(); 