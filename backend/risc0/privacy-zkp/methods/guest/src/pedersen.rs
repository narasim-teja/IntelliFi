use curve25519_dalek::scalar::Scalar;
use curve25519_dalek::ristretto::RistrettoPoint;
use curve25519_dalek::constants::RISTRETTO_BASEPOINT_POINT;
use rand_core::OsRng;
use sha2::{Digest, Sha512};

// Generator points (in a real implementation these would be generated through a trusted setup)
pub const H: RistrettoPoint = RISTRETTO_BASEPOINT_POINT;
lazy_static! {
    pub static ref G: RistrettoPoint = {
        // Generate G as the hash of "G" to get a random point
        let mut hasher = Sha512::new();
        hasher.update(b"G");
        let hash = hasher.finalize();
        RistrettoPoint::from_hash(hash)
    };
}

pub struct PedersenCommitment {
    pub commitment: RistrettoPoint,
    pub amount: u64,
    pub blinding_factor: Scalar,
}

impl PedersenCommitment {
    // Create a new commitment to an amount
    pub fn new(amount: u64) -> Self {
        let blinding_factor = Scalar::random(&mut OsRng);
        let commitment = Self::commit(amount, &blinding_factor);
        
        Self {
            commitment,
            amount,
            blinding_factor,
        }
    }
    
    // Commit to a value using a specific blinding factor
    pub fn commit(amount: u64, blinding_factor: &Scalar) -> RistrettoPoint {
        let amount_scalar = Scalar::from(amount);
        G.mul(amount_scalar) + H.mul(*blinding_factor)
    }
    
    // Verify that a commitment opens to a specific amount
    pub fn verify(&self, amount: u64) -> bool {
        let expected = Self::commit(amount, &self.blinding_factor);
        expected == self.commitment
    }
    
    // Add two commitments together (homomorphic property)
    pub fn add(&self, other: &PedersenCommitment) -> PedersenCommitment {
        PedersenCommitment {
            commitment: self.commitment + other.commitment,
            amount: self.amount + other.amount,
            blinding_factor: self.blinding_factor + other.blinding_factor,
        }
    }
} 