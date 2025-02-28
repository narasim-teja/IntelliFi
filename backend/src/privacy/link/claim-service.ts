import { ContractManager } from '../contract';
import { SpendNoteLink, SpendNoteLinkData } from './index';

/**
 * Interface for the result of claiming a spend note
 */
export interface ClaimResult {
  success: boolean;
  message: string;
  txHash?: string;
}

/**
 * Service for handling the claim process for spend notes
 */
export class ClaimService {
  private contractManager: ContractManager;
  
  constructor() {
    this.contractManager = new ContractManager();
  }
  
  /**
   * Claim a spend note using a signature from the recipient
   * @param encodedData The encoded data from the URL
   * @param signature The signature from the recipient
   * @param recipientAddress The wallet address of the recipient
   * @returns The result of the claim
   */
  public async claimSpendNote(
    encodedData: string,
    signature: string,
    recipientAddress: string
  ): Promise<ClaimResult> {
    try {
      // Verify the link
      const verifyResult = SpendNoteLink.verifyLink(encodedData);
      if (!verifyResult.isValid || !verifyResult.data) {
        return {
          success: false,
          message: verifyResult.error || 'Invalid link'
        };
      }
      
      const linkData = verifyResult.data;
      
      // Create a message for the recipient to sign
      const message = this.createClaimMessage(linkData, recipientAddress);
      
      // Verify the signature
      const isValidSignature = SpendNoteLink.verifySignature(
        message,
        signature,
        recipientAddress
      );
      
      if (!isValidSignature) {
        return {
          success: false,
          message: 'Invalid signature'
        };
      }
      
      // Check if the nullifier has already been spent
      const isSpent = await this.contractManager.isNullifierSpent(linkData.nullifier);
      if (isSpent) {
        return {
          success: false,
          message: 'This spend note has already been claimed'
        };
      }
      
      // Spend the note on the contract
      const txHash = await this.contractManager.spendNote(
        linkData.noteHash,
        linkData.nullifier,
        recipientAddress,
        linkData.merkleProof
      );
      
      return {
        success: true,
        message: 'Spend note claimed successfully',
        txHash
      };
    } catch (error) {
      console.error('Error claiming spend note:', error);
      return {
        success: false,
        message: 'An error occurred while claiming the spend note'
      };
    }
  }
  
  /**
   * Create a message for the recipient to sign to claim the spend note
   * @param linkData The data from the link
   * @param recipientAddress The wallet address of the recipient
   * @returns The message to sign
   */
  private createClaimMessage(
    linkData: SpendNoteLinkData,
    recipientAddress: string
  ): string {
    return `I, ${recipientAddress}, am claiming a spend note with hash ${linkData.noteHash} and nullifier ${linkData.nullifier}. Timestamp: ${linkData.timestamp}`;
  }
  
  /**
   * Get information about a spend note from a link
   * @param encodedData The encoded data from the URL
   * @returns Information about the spend note
   */
  public async getSpendNoteInfo(encodedData: string): Promise<{
    isValid: boolean;
    noteHash?: string;
    amount?: string;
    isSpent?: boolean;
    error?: string;
  }> {
    try {
      // Verify the link
      const verifyResult = SpendNoteLink.verifyLink(encodedData);
      if (!verifyResult.isValid || !verifyResult.data) {
        return {
          isValid: false,
          error: verifyResult.error || 'Invalid link'
        };
      }
      
      const linkData = verifyResult.data;
      
      // Get the spend note from the contract
      const note = await this.contractManager.getSpendNote(linkData.noteHash);
      
      // Check if the nullifier has been spent
      const isSpent = await this.contractManager.isNullifierSpent(linkData.nullifier);
      
      return {
        isValid: true,
        noteHash: linkData.noteHash,
        amount: note.amount,
        isSpent
      };
    } catch (error) {
      console.error('Error getting spend note info:', error);
      return {
        isValid: false,
        error: 'An error occurred while getting spend note information'
      };
    }
  }
} 