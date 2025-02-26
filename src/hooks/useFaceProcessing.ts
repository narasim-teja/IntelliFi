import { useState, useCallback, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

interface FaceProcessingResult {
  embedding: Float32Array | null;
  hash: string | null;
  error: string | null;
  isProcessing: boolean;
  similarity?: number | null;
}

interface StoredFace {
  embedding: number[];
  hash: string;
  timestamp: number;
}

// Threshold for face similarity (0.5 is a good starting point, adjust based on testing)
const SIMILARITY_THRESHOLD = 0.5;
const STORAGE_KEY = 'stored_faces';

export const useFaceProcessing = () => {
  const modelRef = useRef<tf.GraphModel | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [result, setResult] = useState<FaceProcessingResult>({
    embedding: null,
    hash: null,
    error: null,
    isProcessing: false,
    similarity: null
  });

  // Load stored faces from localStorage
  const loadStoredFaces = (): StoredFace[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  };

  // Save faces to localStorage
  const saveStoredFaces = (faces: StoredFace[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
  };

  // Calculate cosine similarity between two embeddings
  const calculateSimilarity = (embedding1: Float32Array | number[], embedding2: Float32Array | number[]): number => {
    const dotProduct = (embedding1 as any).reduce((sum: number, value: number, i: number) => sum + value * (embedding2 as any)[i], 0);
    const norm1 = Math.sqrt((embedding1 as any).reduce((sum: number, value: number) => sum + value * value, 0));
    const norm2 = Math.sqrt((embedding2 as any).reduce((sum: number, value: number) => sum + value * value, 0));
    return dotProduct / (norm1 * norm2);
  };

  // Check if a face is similar to any stored faces
  const findSimilarFace = (currentEmbedding: Float32Array): number | null => {
    const storedFaces = loadStoredFaces();
    if (storedFaces.length === 0) return null;

    const similarities = storedFaces.map(face => 
      calculateSimilarity(currentEmbedding, face.embedding)
    );
    
    const maxSimilarity = Math.max(...similarities);
    return maxSimilarity >= SIMILARITY_THRESHOLD ? maxSimilarity : null;
  };

  // Store a new face embedding
  const storeFaceEmbedding = (embedding: Float32Array, hash: string) => {
    const storedFaces = loadStoredFaces();
    const newFace: StoredFace = {
      embedding: Array.from(embedding),
      hash,
      timestamp: Date.now()
    };
    storedFaces.push(newFace);
    saveStoredFaces(storedFaces);
  };

  // Initialize TensorFlow backend and load model
  useEffect(() => {
    const initTF = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();

        // Load the InsightFace model
        const model = await tf.loadGraphModel('/models/insightface/model.json');
        modelRef.current = model;
        setModelLoading(false);
        console.log('Model loaded successfully');
      } catch (error) {
        console.error('Failed to initialize TensorFlow or load model:', error);
        setResult(prev => ({
          ...prev,
          error: 'Failed to initialize face processing model'
        }));
      }
    };
    initTF();

    // Cleanup
    return () => {
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, []);

  const preprocessImage = async (img: HTMLImageElement): Promise<tf.Tensor3D> => {
    // Convert image to tensor
    const tensor = tf.browser.fromPixels(img);
    
    // Resize to 192x192 (required size for Buffalo-L model)
    const resized = tf.image.resizeBilinear(tensor, [192, 192]);
    
    // Normalize pixel values to [-1, 1]
    const normalized = tf.sub(tf.div(resized, 127.5), 1);
    
    // Add batch dimension
    const batched = normalized.expandDims(0);
    
    // Convert from NHWC to NCHW format
    const transposed = tf.transpose(batched, [0, 3, 1, 2]);
    
    // Clean up intermediate tensors
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    batched.dispose();
    
    return transposed as tf.Tensor3D;
  };

  const getEmbedding = async (inputTensor: tf.Tensor3D): Promise<Float32Array> => {
    if (!modelRef.current) {
      throw new Error('Model not loaded');
    }

    // Run inference
    const prediction = await modelRef.current.predict(inputTensor) as tf.Tensor;
    
    // Get embedding data
    const embedding = await prediction.data() as Float32Array;
    
    // Clean up
    prediction.dispose();
    
    return embedding;
  };

  const generateHash = async (embedding: Float32Array): Promise<string> => {
    // Convert Float32Array to regular array of numbers
    const numbers = Array.from(embedding);
    // Convert to string and then to ArrayBuffer
    const data = new TextEncoder().encode(JSON.stringify(numbers));
    // Generate hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const processImage = useCallback(async (imageData: string) => {
    if (modelLoading) {
      setResult(prev => ({
        ...prev,
        error: 'Model is still loading, please wait...',
        isProcessing: false
      }));
      return;
    }

    setResult(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      // Load the image
      const img = new Image();
      img.src = imageData;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Preprocess the image
      const inputTensor = await preprocessImage(img);

      // Get face embedding
      const embedding = await getEmbedding(inputTensor);
      
      // Check for similar faces
      const similarity = findSimilarFace(embedding);
      
      // Generate hash
      const hashHex = await generateHash(embedding);
      const fullHash = '0x' + hashHex;

      // Clean up tensors
      inputTensor.dispose();

      // If no similar face found, store this one
      if (similarity === null) {
        storeFaceEmbedding(embedding, fullHash);
      }

      setResult({
        embedding,
        hash: fullHash,
        error: null,
        isProcessing: false,
        similarity
      });

    } catch (error) {
      setResult({
        embedding: null,
        hash: null,
        error: error instanceof Error ? error.message : 'Failed to process image',
        isProcessing: false,
        similarity: null
      });
    }
  }, [modelLoading]);

  return {
    processImage,
    ...result,
    modelLoading,
    isFaceRegistered: result.similarity !== null,
  };
}; 