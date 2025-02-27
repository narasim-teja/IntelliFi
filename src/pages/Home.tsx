import { useState, useEffect } from "react";
import { ShieldCheckIcon, LockClosedIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { FaceProcessor } from "../components/FaceProcessor";
import { useDynamicContext, DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useContractInteraction } from "../hooks/useContractInteraction";

export default function Home() {
  const [faceHash, setFaceHash] = useState<string | null>(null);
  const [faceEmbedding, setFaceEmbedding] = useState<Float32Array | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [registrationTimestamp, setRegistrationTimestamp] = useState<number | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [uniquenessResult, setUniquenessResult] = useState<{
    isUnique: boolean;
    similarity: number | null;
  } | null>(null);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  
  const { primaryWallet, user } = useDynamicContext();
  const { 
    registerFaceHash, 
    verifyFaceHash,
    checkFaceUniqueness,
    resetLocalData,
    isRegistering, 
    error: contractError,
    registrationStatus,
    uniquenessStatus
  } = useContractInteraction();

  // Check registration status when wallet connects
  useEffect(() => {
    const checkWalletRegistration = async () => {
      if (primaryWallet && faceHash) {
        try {
          const isVerified = await verifyFaceHash(faceHash);
          setIsRegistered(isVerified);
        } catch (error) {
          console.error("Error checking registration status:", error);
        }
      }
    };
    
    checkWalletRegistration();
  }, [primaryWallet, faceHash, verifyFaceHash]);

  // Update state when registration status changes
  useEffect(() => {
    if (registrationStatus === 'success') {
      setIsRegistered(true);
      setRegistrationTimestamp(Math.floor(Date.now() / 1000));
    }
  }, [registrationStatus]);

  // Update state when uniqueness check is completed
  useEffect(() => {
    if (uniquenessStatus && uniquenessStatus !== 'checking') {
      setIsCheckingUniqueness(false);
      setUniquenessResult({
        isUnique: uniquenessStatus === 'unique',
        similarity: null
      });
    }
  }, [uniquenessStatus]);

  // Handle face hash generation
  const handleFaceHashGenerated = (hash: string, embedding?: Float32Array) => {
    setFaceHash(hash);
    if (embedding) {
      setFaceEmbedding(embedding);
    }
    setUniquenessResult(null);
  };

  // Handle IPFS hash generation
  const handleIpfsHashGenerated = (hash: string) => {
    setIpfsHash(hash);
  };

  // Combined function to check uniqueness and register if unique
  const handleRegisterOnChain = async () => {
    if (!faceEmbedding || !faceHash || !ipfsHash) {
      console.error("Missing face data or IPFS hash for registration");
      return;
    }

    console.log("Starting registration process...");
    console.log("Face hash:", faceHash.substring(0, 10) + "...");
    console.log("IPFS hash:", ipfsHash);
    
    // First, check uniqueness
    setIsCheckingUniqueness(true);
    try {
      console.log("Checking face uniqueness...");
      const isUnique = await checkFaceUniqueness(faceEmbedding, ipfsHash);
      console.log("Uniqueness check result:", isUnique);
      
      if (isUnique) {
        // If unique, proceed with registration
        console.log("Face is unique, proceeding with registration...");
        await registerFaceHash(faceHash, ipfsHash);
        console.log("Registration completed");
      } else {
        console.log("Face is not unique, cannot register");
        // Set uniqueness result to show the user
        setUniquenessResult({
          isUnique: false,
          similarity: null
        });
      }
    } catch (error: unknown) {
      console.error("Error during registration process:", error);
      
      // Show error in UI
      setUniquenessResult({
        isUnique: false,
        similarity: null
      });
    } finally {
      setIsCheckingUniqueness(false);
    }
  };

  // Function to reset identity (for testing purposes)
  const resetIdentity = () => {
    resetLocalData();
    setIsRegistered(false);
    setRegistrationTimestamp(null);
    setFaceHash(null);
    setFaceEmbedding(null);
    setUniquenessResult(null);
    setIpfsHash(null);
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="w-full">
      {/* Hero section */}
      <div className="w-full bg-gradient-to-b from-gray-50 to-white py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center px-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Secure Identity Verification
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Register your identity securely using our decentralized facial authentication system. Your biometric data remains private and is processed locally.
          </p>
          {!user && (
            <div className="mt-8">
              <DynamicWidget />
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Face Processor Section */}
          <div className="space-y-4">
            <FaceProcessor 
              onHashGenerated={handleFaceHashGenerated} 
              onIpfsHashGenerated={handleIpfsHashGenerated}
              hasWallet={!!primaryWallet}
            />
            
            {/* Uniqueness Check Button */}
            {faceHash && ipfsHash && !isRegistered && !uniquenessResult && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-gray-700 mb-4">
                  Ready to register your face on the blockchain? Click below to check uniqueness and register.
                </p>
                <button 
                  className={`w-full rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    !user
                      ? "bg-gray-400 cursor-not-allowed"
                      : isCheckingUniqueness || isRegistering
                        ? "bg-indigo-400 cursor-wait"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                  onClick={handleRegisterOnChain}
                  disabled={!user || isCheckingUniqueness || isRegistering || !ipfsHash || !faceEmbedding}
                >
                  {!user 
                    ? "Connect Wallet to Register"
                    : isCheckingUniqueness
                      ? "Checking Face Uniqueness..."
                      : isRegistering
                        ? "Registering on Blockchain..."
                        : "Register Identity on Blockchain"
                  }
                </button>
              </div>
            )}
            
            {/* Uniqueness Check Results */}
            {uniquenessResult && !isRegistered && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {uniquenessResult.isUnique ? (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                      <p className="ml-2 text-green-700 font-medium">Face is Unique!</p>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      This face hasn't been registered by any other wallet. You can proceed with registration.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                      <p className="ml-2 text-amber-700 font-medium">Face Already Registered</p>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      This face appears to be already registered by another wallet.
                      {uniquenessResult.similarity !== null && (
                        <span> Similarity score: {(uniquenessResult.similarity * 100).toFixed(1)}%</span>
                      )}
                    </p>
                    
                    <p className="mt-3 text-sm text-amber-700">
                      To prevent identity fraud, you cannot register this face. Please try with a different face.
                    </p>
                  </div>
                )}
                
                {/* Register Button (only shown if face is unique) */}
                {uniquenessResult.isUnique && (
                  <button 
                    className={`w-full mt-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      !user || !ipfsHash
                        ? "bg-gray-400 cursor-not-allowed"
                        : isRegistering
                          ? "bg-indigo-400 cursor-wait"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                    onClick={handleRegisterOnChain}
                    disabled={!user || isRegistering || !ipfsHash}
                  >
                    {!user 
                      ? "Connect Wallet to Register"
                      : !ipfsHash
                        ? "Upload to IPFS First"
                        : isRegistering
                          ? "Registering on Blockchain..."
                          : "Register Identity on Blockchain"
                    }
                  </button>
                )}
                
                {contractError && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                    {contractError}
                  </div>
                )}
              </div>
            )}

            {/* Registration Success */}
            {isRegistered && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    <p className="ml-2 text-green-700 font-medium">Registration Successful!</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Your face has been successfully registered on the blockchain.
                    {registrationTimestamp && (
                      <span> Registered on: {formatTimestamp(registrationTimestamp)}</span>
                    )}
                  </p>
                </div>
                
                <button 
                  className="w-full mt-4 rounded-lg px-4 py-3 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={resetIdentity}
                >
                  Start Over
                </button>
              </div>
            )}
            
           
          </div>

          {/* Security Information */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
                <h3 className="ml-2 text-lg font-medium text-gray-900">Privacy First</h3>
              </div>
              <p className="mt-2 text-gray-600">
                Your facial data is processed entirely on your device. No biometric information leaves your browser, ensuring maximum privacy and security.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <LockClosedIcon className="h-6 w-6 text-indigo-600" />
                <h3 className="ml-2 text-lg font-medium text-gray-900">Blockchain Secured</h3>
              </div>
              <p className="mt-2 text-gray-600">
                Your identity verification is registered directly on the Base Sepolia blockchain, creating an immutable record of your verification that can be used for secure authentication.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                <h3 className="ml-2 text-lg font-medium text-gray-900">Sybil Resistance</h3>
              </div>
              <p className="mt-2 text-gray-600">
                Our system prevents the same face from being registered with multiple wallets. Before registration, we check if your face is already associated with another wallet to prevent identity fraud.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 