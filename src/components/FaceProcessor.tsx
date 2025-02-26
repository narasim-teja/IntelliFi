import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraIcon, ArrowPathIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useFaceProcessing } from '../hooks/useFaceProcessing';
import Webcam from 'react-webcam';

interface FaceProcessorProps {
  onHashGenerated?: (hash: string) => void;
  isWalletLinked?: boolean;
}

export const FaceProcessor: React.FC<FaceProcessorProps> = ({ 
  onHashGenerated, 
  isWalletLinked = false 
}) => {
  const { processImage, hash, isProcessing, error, similarity, isFaceRegistered } = useFaceProcessing();
  const webcamRef = useRef<Webcam>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Check if we already have a stored hash in localStorage
  useEffect(() => {
    const storedHash = localStorage.getItem('face_hash');
    if (storedHash && onHashGenerated) {
      onHashGenerated(storedHash);
    }
  }, [onHashGenerated]);

  // Call onHashGenerated whenever hash changes
  useEffect(() => {
    if (hash && onHashGenerated) {
      onHashGenerated(hash);
    }
  }, [hash, onHashGenerated]);

  const handleCameraError = useCallback((err: string | DOMException) => {
    console.error('Camera error:', err);
    const errorMessage = 
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera access in your browser settings.'
        : 'Failed to access camera. Please make sure your device has a working camera.';
    
    setCameraError(errorMessage);
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(() => {
    setCameraError(null);
    
    // Check if navigator.mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Your browser does not support camera access. Please try a different browser.');
      return;
    }
    
    setCameraActive(true);
  }, []);

  const captureImage = useCallback(() => {
    if (!webcamRef.current || !cameraActive) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      // Process the captured image
      processImage(imageSrc);
      // Hide camera after capturing
      setCameraActive(false);
    } else {
      setCameraError('Failed to capture image. Please try again.');
    }
  }, [cameraActive, processImage]);

  // If we have a stored hash and wallet is linked, just show the result
  const storedHash = localStorage.getItem('face_hash');
  const showCameraInterface = !storedHash || (!isWalletLinked && !hash);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="relative">
        {/* Video element for camera feed */}
        {showCameraInterface && !hash && (
          <div className="relative">
            {cameraActive && (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: "user",
                  width: 640,
                  height: 480
                }}
                onUserMediaError={handleCameraError}
                className="w-full rounded-xl border-2 border-indigo-500"
                mirrored={true}
              />
            )}
            
            {/* Camera button or activation area */}
            {!cameraActive && !isProcessing && (
              <div 
                onClick={startCamera}
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors hover:border-indigo-400"
              >
                <div className="space-y-4">
                  <div className="mx-auto h-16 w-16 text-gray-400">
                    <CameraIcon className="h-16 w-16" />
                  </div>
                  <div className="text-gray-600">
                    <p className="text-xl font-medium">Take a face photo</p>
                    <p className="mt-2 text-sm text-gray-500">Click to activate camera</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Capture button when camera is active */}
            {cameraActive && !isProcessing && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <button
                  onClick={captureImage}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                >
                  Capture Photo
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Display stored hash info if available */}
        {storedHash && !showCameraInterface && !hash && (
          <div className="p-6 bg-gray-50 rounded-xl">
            <div className="flex items-center space-x-2 text-green-600 mb-4">
              <ShieldCheckIcon className="h-6 w-6" />
              <span className="text-lg font-medium">Face Already Registered</span>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Your Face Hash:</p>
              <p className="font-mono text-sm bg-white p-3 rounded-lg border border-gray-200 text-gray-900 break-all">{storedHash}</p>
            </div>
            
            {/* Show confirmation message when wallet is linked */}
            {isWalletLinked && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg text-green-700">
                <p className="font-medium">Face hash successfully linked to your wallet!</p>
                <p className="text-sm mt-1">Your identity is now securely registered in the system.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Camera error message */}
      {cameraError && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg text-red-700">
          {cameraError}
        </div>
      )}

      {isProcessing && (
        <div className="mt-6 flex items-center justify-center space-x-2 text-indigo-600">
          <ArrowPathIcon className="h-6 w-6 animate-spin" />
          <span className="text-lg">Processing securely...</span>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {hash && (
        <div className="mt-6 p-6 bg-gray-50 rounded-xl">
          {isFaceRegistered ? (
            <div className="flex items-center space-x-2 text-amber-600 mb-4">
              <ExclamationTriangleIcon className="h-6 w-6" />
              <span className="text-lg font-medium">Face Already Registered</span>
              <span className="text-sm text-gray-600 ml-2">
                (Similarity: {(similarity! * 100).toFixed(1)}%)
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-green-600 mb-4">
              <ShieldCheckIcon className="h-6 w-6" />
              <span className="text-lg font-medium">New Face Processed Successfully</span>
            </div>
          )}
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Generated Face Hash:</p>
            <p className="font-mono text-sm bg-white p-3 rounded-lg border border-gray-200 text-gray-900 break-all">{hash}</p>
          </div>
          
          {/* Only show "Take Another Photo" button if wallet is not linked yet */}
          {!isWalletLinked && (
            <div className="mt-6">
              <button
                onClick={() => {
                  // Reset state to take another photo
                  if (hash) {
                    startCamera();
                  }
                }}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors"
              >
                Take Another Photo
              </button>
            </div>
          )}
          
          {/* Show confirmation message when wallet is linked */}
          {isWalletLinked && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg text-green-700">
              <p className="font-medium">Face hash successfully linked to your wallet!</p>
              <p className="text-sm mt-1">Your identity is now securely registered in the system.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 