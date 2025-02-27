import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { NullifierData } from '../types';

// Generate a random 32-byte salt
const generateSalt = (): Uint8Array => {
    return randomBytes(32);
};

// For POC: Generate a random encryption key and IV (in production, use proper key management)
const ENCRYPTION_KEY = randomBytes(32);
const IV = randomBytes(16);

// Generate a non-deterministic nullifier using wallet address, timestamp, and salt
export const generateNullifier = async (walletAddress: string): Promise<NullifierData> => {
    const timestamp = Date.now();
    const salt = generateSalt();
    
    // Combine wallet address, timestamp, and salt
    const data = new Uint8Array([
        ...hexToBytes(walletAddress.slice(2)), // Remove '0x' prefix
        ...new Uint8Array(new BigInt64Array([BigInt(timestamp)]).buffer),
        ...salt
    ]);
    
    // Hash the combined data to create the nullifier
    const nullifierHash = sha256(data);
    const nullifier = '0x' + bytesToHex(nullifierHash);
    
    // Simple encryption for POC
    const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, IV);
    const encrypted = Buffer.concat([cipher.update(nullifierHash), cipher.final()]);
    const encryptedNullifier = '0x' + Buffer.concat([encrypted, cipher.getAuthTag()]).toString('hex');
    
    return {
        nullifier,
        encryptedNullifier,
        timestamp
    };
};

// Verify a nullifier (basic implementation for POC)
export const verifyNullifier = async (
    nullifier: string,
    encryptedNullifier: string
): Promise<boolean> => {
    try {
        const encryptedData = Buffer.from(encryptedNullifier.slice(2), 'hex');
        const authTag = encryptedData.slice(encryptedData.length - 16);
        const encryptedContent = encryptedData.slice(0, encryptedData.length - 16);
        
        const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, IV);
        decipher.setAuthTag(authTag);
        
        const decrypted = Buffer.concat([
            decipher.update(encryptedContent),
            decipher.final()
        ]);
        
        return '0x' + decrypted.toString('hex') === nullifier;
    } catch (error) {
        console.error('Error verifying nullifier:', error);
        return false;
    }
};
