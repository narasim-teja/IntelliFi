import { useState, useEffect } from "react";
import { ShieldCheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { FaceProcessor } from "../components/FaceProcessor";
import { useDynamicContext, DynamicWidget } from "@dynamic-labs/sdk-react-core";

// Key for storing signature in localStorage
const SIGNATURE_STORAGE_KEY = 'face_signature';
const FACE_HASH_STORAGE_KEY = 'face_hash';

export default function Home() {
  const [faceHash, setFaceHash] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const { primaryWallet, user } = useDynamicContext();

  // Load saved signature and face hash from localStorage on component mount
  useEffect(() => {
    const savedSignature = localStorage.getItem(SIGNATURE_STORAGE_KEY);
    const savedFaceHash = localStorage.getItem(FACE_HASH_STORAGE_KEY);
    
    if (savedSignature) {
      setSignature(savedSignature);
    }
    
    if (savedFaceHash) {
      setFaceHash(savedFaceHash);
    }
  }, []);

  // Save face hash to localStorage when it changes
  const handleFaceHashGenerated = (hash: string) => {
    setFaceHash(hash);
    localStorage.setItem(FACE_HASH_STORAGE_KEY, hash);
  };

  const handleSignHash = async () => {
    if (!faceHash || !primaryWallet) {
      console.error("Missing required data for signing");
      return;
    }

    try {
      // Create a message to sign that includes the face hash
      const message = `I confirm this face hash belongs to me:\n\n${faceHash}`;
      
      // Sign the message using the primary wallet
      const signedMessage = await primaryWallet.signMessage(message);
      if (signedMessage) {
        // Save signature to state and localStorage
        setSignature(signedMessage);
        localStorage.setItem(SIGNATURE_STORAGE_KEY, signedMessage);
        console.log("Signature:", signedMessage);
        // Here you would typically send the signature and hash to your backend
      } else {
        console.error("Failed to get signature");
      }
    } catch (error) {
      console.error("Error signing message:", error);
    }
  };

  // Function to reset identity (for testing purposes)
  const resetIdentity = () => {
    localStorage.removeItem(SIGNATURE_STORAGE_KEY);
    localStorage.removeItem(FACE_HASH_STORAGE_KEY);
    setSignature(null);
    setFaceHash(null);
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
              isWalletLinked={!!signature} 
            />
            
            {/* Sign Button and Signature Display */}
            {faceHash && !signature && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <button 
                  className={`w-full rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    !user
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                  onClick={handleSignHash}
                  disabled={!user}
                >
                  {!user 
                    ? "Connect Wallet to Sign"
                    : "Sign & Register Identity"
                  }
                </button>
              </div>
            )}

            {signature && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-green-700 font-medium">Identity Successfully Registered!</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Your face hash has been cryptographically signed with your wallet.
                  </p>
                  <details className="mt-3">
                    <summary className="text-sm text-indigo-600 cursor-pointer">View Signature Details</summary>
                    <p className="mt-2 text-xs text-gray-600 break-all font-mono bg-white p-2 rounded border border-gray-200">
                      {signature}
                    </p>
                  </details>
                </div>
                
                {/* Reset button (for development/testing purposes) */}
                <div className="mt-4 text-right">
                  <button 
                    onClick={resetIdentity}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Reset Identity
                  </button>
                </div>
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
                Your identity verification is cryptographically signed and secured on the blockchain, creating an immutable record of your verification.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 