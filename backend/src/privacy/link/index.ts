import { ethers } from 'ethers';
import { NullifierData } from '../types';
import { base64url } from 'jose';

/**
 * Interface for the data encoded in a spend note link
 */
export interface SpendNoteLinkData {
  noteHash: string;
  nullifier: string;
  encryptedNullifier: string;
  merkleProof: string[];
  timestamp: number;
  expiresAt: number;
}

/**
 * Interface for the result of verifying a spend note link
 */
export interface VerifyLinkResult {
  isValid: boolean;
  data?: SpendNoteLinkData;
  error?: string;
}

/**
 * Class for generating and verifying spend note links
 */
export class SpendNoteLink {
  /**
   * Generate a spend note link that can be shared with the recipient
   * @param noteHash The hash of the spend note
   * @param nullifierData The nullifier data for the spend note
   * @param merkleProof The Merkle proof for the spend note
   * @param expiresInMinutes How long the link should be valid for (in minutes)
   * @returns A URL that can be shared with the recipient
   */
  public static generateLink(
    noteHash: string,
    nullifierData: NullifierData,
    merkleProof: string[],
    expiresInMinutes: number = 60
  ): string {
    // Create the link data
    const linkData: SpendNoteLinkData = {
      noteHash,
      nullifier: nullifierData.nullifier,
      encryptedNullifier: nullifierData.encryptedNullifier,
      merkleProof,
      timestamp: Date.now(),
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000
    };

    // Encode the data as a base64url string
    const encodedData = base64url.encode(JSON.stringify(linkData));

    // Create the URL (in a real app, this would be your frontend URL)
    return `http://localhost:5173/claim?data=${encodedData}`;
  }

  /**
   * Verify a spend note link and extract the data
   * @param encodedData The encoded data from the URL
   * @returns The result of the verification
   */
  public static verifyLink(encodedData: string): VerifyLinkResult {
    try {
      // Decode the data
      const decodedData = JSON.parse(base64url.decode(encodedData).toString());
      
      // Validate the data structure
      const data = decodedData as SpendNoteLinkData;
      if (!data.noteHash || !data.nullifier || !data.encryptedNullifier || 
          !data.merkleProof || !data.timestamp || !data.expiresAt) {
        return { isValid: false, error: 'Invalid link data structure' };
      }

      // Check if the link has expired
      if (data.expiresAt < Date.now()) {
        return { isValid: false, error: 'Link has expired' };
      }

      return { isValid: true, data };
    } catch {
      return { isValid: false, error: 'Failed to decode link data' };
    }
  }

  /**
   * Verify that a signature was created by the owner of a wallet address
   * @param message The message that was signed
   * @param signature The signature
   * @param expectedAddress The expected wallet address
   * @returns True if the signature is valid, false otherwise
   */
  public static verifySignature(
    message: string,
    signature: string,
    expectedAddress: string
  ): boolean {
    try {
      // Recover the address from the signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      // Check if the recovered address matches the expected address
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
} 