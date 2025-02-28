import { ethers } from 'ethers';
import {  NullifierData } from '../types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ABI for the FaceRegistration contract
const FaceRegistrationABI = [
  // Registration functions
  "function register(bytes32 _faceHash, string calldata _ipfsHash, bytes calldata _publicKey) external",
  "function getRegistration(address _wallet) external view returns (tuple(address wallet, bytes publicKey, bytes32 faceHash, string ipfsHash, uint256 timestamp))",
  "function totalRegistrants() external view returns (uint256)",
  
  // Spend note functions
  "function createSpendNote(bytes32 _noteHash) external payable",
  "function updateMerkleRoot(bytes32 _newRoot) external",
  "function spendNote(bytes32 _noteHash, bytes32 _nullifier, address payable _recipient, bytes32[] calldata _merkleProof) external",
  "function getSpendNote(bytes32 _noteHash) external view returns (tuple(bytes32 noteHash, uint256 amount, bool spent, uint256 timestamp))",
  "function totalSpendNotes() external view returns (uint256)",
  
  // State variables
  "function merkleRoot() external view returns (bytes32)",
  "function spentNullifiers(bytes32) external view returns (bool)",
  
  // Events
  "event Registered(address indexed wallet, bytes32 faceHash, string ipfsHash, bytes publicKey, uint256 timestamp)",
  "event SpendNoteCreated(address indexed wallet, bytes32 noteHash, uint256 amount, uint256 timestamp)",
  "event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 timestamp)",
  "event NoteSpent(bytes32 indexed noteHash, bytes32 nullifier, address recipient, uint256 timestamp)"
];

export class ContractManager {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  
  constructor() {
    const rpcUrl = process.env.RPC_URL;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!rpcUrl || !contractAddress || !privateKey) {
      throw new Error('Missing environment variables: RPC_URL, CONTRACT_ADDRESS, or PRIVATE_KEY');
    }
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, FaceRegistrationABI, this.wallet);
  }
  
  /**
   * Register a wallet in the FaceRegistration contract
   * @param faceHash The hash of the user's facial data
   * @param ipfsHash The IPFS hash where the face embedding is stored
   * @param publicKey The public key associated with the wallet
   * @returns The transaction hash
   */
  public async register(
    faceHash: string,
    ipfsHash: string,
    publicKey: string
  ): Promise<string> {
    try {
      // Convert publicKey to bytes if it's not already
      const publicKeyBytes = publicKey.startsWith('0x') 
        ? publicKey 
        : '0x' + Buffer.from(publicKey).toString('hex');
      
      // Send transaction to register
      const tx = await this.contract.register(faceHash, ipfsHash, publicKeyBytes);
      const receipt = await tx.wait();
      
      return receipt.hash;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // If the error is because the wallet is already registered, we can ignore it
      if (error.reason && typeof error.reason === 'string' && error.reason.includes('Already registered')) {
        console.log('Wallet is already registered');
        return 'already-registered';
      }
      
      console.error('Error registering wallet:', error);
      throw error;
    }
  }
  
  /**
   * Check if a wallet is registered
   * @param walletAddress The wallet address to check
   * @returns True if the wallet is registered, false otherwise
   */
  public async isRegistered(walletAddress: string): Promise<boolean> {
    try {
      const registration = await this.contract.getRegistration(walletAddress);
      // If the wallet address in the registration is not the zero address, it's registered
      return registration[0] !== ethers.ZeroAddress;
    } catch (error) {
      console.error('Error checking if wallet is registered:', error);
      return false;
    }
  }
  
  /**
   * Create a spend note on the blockchain
   * @param walletAddress The wallet address of the user
   * @param nullifierData The nullifier data generated for this transaction
   * @param amount The amount to send with the spend note (in ETH)
   * @returns The transaction hash and note hash
   */
  public async createSpendNote(
    walletAddress: string, 
    nullifierData: NullifierData,
    amount: string = '0.1' // Default to 0.1 ETH to match the deployed contract
  ): Promise<{
    txHash: string;
    noteHash: string;
  }> {
    try {
      // Create the note hash from wallet address and nullifier
      // Remove '0x' prefix from both strings before hashing
      const walletAddressBytes = Buffer.from(walletAddress.slice(2), 'hex');
      const nullifierBytes = Buffer.from(nullifierData.nullifier.slice(2), 'hex');
      
      // Concatenate and hash
      const combinedData = Buffer.concat([walletAddressBytes, nullifierBytes]);
      const noteHash = ethers.keccak256(combinedData);
      
      // Send transaction with the specified amount
      const tx = await this.contract.createSpendNote(noteHash, {
        value: ethers.parseEther(amount)
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      return {
        txHash: receipt.hash,
        noteHash
      };
    } catch (error) {
      console.error('Error creating spend note:', error);
      throw error;
    }
  }
  
  /**
   * Update the Merkle root in the contract
   * @param newRoot The new Merkle root hash
   * @returns The transaction hash
   */
  public async updateMerkleRoot(newRoot: string): Promise<string> {
    try {
      const tx = await this.contract.updateMerkleRoot(newRoot);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error updating Merkle root:', error);
      throw error;
    }
  }
  
  /**
   * Spend a note by providing the nullifier and Merkle proof
   * @param noteHash The hash of the spend note
   * @param nullifier The nullifier associated with the note
   * @param recipient The address to send the funds to
   * @param merkleProof The Merkle proof verifying the note is in the tree
   * @returns The transaction hash
   */
  public async spendNote(
    noteHash: string,
    nullifier: string,
    recipient: string,
    merkleProof: string[]
  ): Promise<string> {
    try {
      const tx = await this.contract.spendNote(noteHash, nullifier, recipient, merkleProof);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error spending note:', error);
      throw error;
    }
  }
  
  /**
   * Check if a nullifier has been spent
   * @param nullifier The nullifier to check
   * @returns True if the nullifier has been spent, false otherwise
   */
  public async isNullifierSpent(nullifier: string): Promise<boolean> {
    try {
      return await this.contract.spentNullifiers(nullifier);
    } catch (error) {
      console.error('Error checking if nullifier is spent:', error);
      throw error;
    }
  }
  
  /**
   * Get the current Merkle root from the contract
   * @returns The current Merkle root
   */
  public async getMerkleRoot(): Promise<string> {
    try {
      return await this.contract.merkleRoot();
    } catch (error) {
      console.error('Error getting Merkle root:', error);
      throw error;
    }
  }
  
  /**
   * Get a spend note by its hash
   * @param noteHash The hash of the spend note
   * @returns The spend note details
   */
  public async getSpendNote(noteHash: string): Promise<{
    noteHash: string;
    amount: string;
    spent: boolean;
    timestamp: number;
  }> {
    try {
      const note = await this.contract.getSpendNote(noteHash);
      return {
        noteHash: note[0],
        amount: ethers.formatEther(note[1]),
        spent: note[2],
        timestamp: Number(note[3])
      };
    } catch (error) {
      console.error('Error getting spend note:', error);
      throw error;
    }
  }
  
  /**
   * Get the total number of spend notes
   * @returns The count of spend notes
   */
  public async getTotalSpendNotes(): Promise<number> {
    try {
      const total = await this.contract.totalSpendNotes();
      return Number(total);
    } catch (error) {
      console.error('Error getting total spend notes:', error);
      throw error;
    }
  }
} 