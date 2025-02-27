// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FaceRegistration {
    // Structure to store registration details
    struct Registration {
        address wallet;       // User's wallet address (registered caller)
        bytes publicKey;      // Public key of the wallet
        bytes32 faceHash;     // Hash representing the processed face data
        string ipfsHash;      // IPFS hash where the face embedding is stored
        uint256 timestamp;    // Registration timestamp
    }
    
    // Mapping from wallet address to their registration details
    mapping(address => Registration) public registrations;
    
    // Array of registrant addresses (useful for enumeration)
    address[] public registrants;
    
    // Event emitted upon successful registration
    event Registered(
        address indexed wallet,
        bytes32 faceHash,
        string ipfsHash,
        bytes publicKey,
        uint256 timestamp
    );
    
    /**
     * @notice Register a user's face hash along with their public key and IPFS hash.
     * @param _faceHash The hash of the user's facial data (computed off-chain).
     * @param _ipfsHash The IPFS hash where the face embedding is stored.
     * @param _publicKey The public key associated with the user's wallet.
     */
    function register(bytes32 _faceHash, string calldata _ipfsHash, bytes calldata _publicKey) external {
        // Prevent re-registration from the same wallet.
        require(registrations[msg.sender].wallet == address(0), "Already registered");
        
        // Create a new registration struct
        Registration memory newRegistration = Registration({
            wallet: msg.sender,
            publicKey: _publicKey,
            faceHash: _faceHash,
            ipfsHash: _ipfsHash,
            timestamp: block.timestamp
        });
        
        // Store registration data in the mapping
        registrations[msg.sender] = newRegistration;
        
        // Add the registrant to the array for easy enumeration (if needed)
        registrants.push(msg.sender);
        
        // Emit an event for off-chain indexing and transparency
        emit Registered(msg.sender, _faceHash, _ipfsHash, _publicKey, block.timestamp);
    }
    
    /**
     * @notice Retrieve registration details by wallet address.
     * @param _wallet The wallet address of the registrant.
     * @return Registration struct containing the registrant's data.
     */
    function getRegistration(address _wallet) external view returns (Registration memory) {
        return registrations[_wallet];
    }
    
    /**
     * @notice Get the total number of registered users.
     * @return The count of registrants.
     */
    function totalRegistrants() external view returns (uint256) {
        return registrants.length;
    }
}
