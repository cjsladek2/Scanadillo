"use client";
import { useState, useEffect, useRef } from "react";

export default function ImageUpload({ onIngredientsAnalyzed }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = () => {
    setCameraActive(true);
    setError(null); // Clear any previous errors
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && !streamRef.current) {
      initializeCamera();
    }
  }, [cameraActive]);

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            .play()
            .then(() => setVideoReady(true))
            .catch((err) => {
              console.error("Play error:", err);
              setError("Could not play video: " + err.message);
            });
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setVideoReady(false);
  };

  // 🔧 Updated logic for analysis with error handling
  const analyzeImage = async (imageData) => {
    setAnalyzing(true);
    setError(null); // Clear previous errors
    
    try {
      const response = await fetch("http://localhost:8000/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });

      const result = await response.json();
      console.log("🧠 AI result:", result);

      if (result.success) {
        // ✅ Success - pass data to parent and DON'T auto-switch tabs
        onIngredientsAnalyzed(result);
        setError(null);
      } else {
        // ❌ Error from API - display it but DON'T switch tabs
        setError(result.error || "Failed to analyze ingredients");
        onIngredientsAnalyzed(null); // Clear any previous data
      }
    } catch (error) {
      console.error("API Error:", error);
      setError("Could not connect to the server. Make sure the API is running on port 8000.");
      onIngredientsAnalyzed(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !videoReady) {
      setError("Video not ready yet, please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    const imageData = canvas.toDataURL("image/png");
    setSelectedImage(imageData);
    localStorage.setItem("uploadedImage", imageData);
    stopCamera();
    analyzeImage(imageData);
  };

  const cancelCamera = () => stopCamera();

  useEffect(() => {
    const savedImage = localStorage.getItem("uploadedImage");
    if (savedImage) setSelectedImage(savedImage);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function handleImageChange(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const imageData = e.target.result;
        setSelectedImage(imageData);
        localStorage.setItem("uploadedImage", imageData);
        analyzeImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleUploadNew() {
    setSelectedImage(null);
    setError(null);
    localStorage.removeItem("uploadedImage");
    onIngredientsAnalyzed(null);
  }

  function handleTryAgain() {
    setError(null);
    setSelectedImage(null);
    localStorage.removeItem("uploadedImage");
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-green-600 select-none mb-6">
        Upload Ingredients List
      </h2>


      {/* ===============================
          Error Display
      =============================== */}
      {error && (
        <div className="mb-6 w-full max-w-2xl bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-4 animate-fade-in">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                Unable to Analyze Image
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleTryAgain}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Try Another Image
            </button>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ===============================
          Upload Buttons
      =============================== */}
      {!selectedImage && !cameraActive && (
        <div className="flex flex-col space-y-4">
          {/* Large square "Take a Photo" */}
          <button
            onClick={startCamera}
            className="w-64 h-32 border-2 border-dashed border-gray-400 rounded flex items-center justify-center
                     text-gray-500 text-lg font-medium hover:border-indigo-400 hover:bg-indigo-50
                     dark:hover:bg-indigo-950 transition-all"
          >
            📸 Take a Photo
          </button>

          {/* Smaller rectangle "Choose File" */}
          <label
            className="w-64 h-12 border-2 border-dashed border-gray-400 rounded flex items-center justify-center
                     cursor-pointer text-gray-500 text-lg font-medium hover:border-indigo-400 hover:bg-indigo-50
                     dark:hover:bg-indigo-950 transition-all"
          >
            📁 Choose File
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* ===============================
          Camera Preview
      =============================== */}
      {cameraActive && (
        <div className="flex flex-col items-center space-y-4 w-full max-w-2xl">
          <div className="relative w-full">
            <video
              ref={videoRef}
              className="w-full h-96 border-2 border-indigo-200 rounded-lg bg-black object-cover shadow-lg"
              autoPlay
              playsInline
              muted
            />
            {!videoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900/50 to-blue-900/50 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3"></div>
                  <p className="text-white text-lg font-medium">Loading camera...</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={takePhoto}
              disabled={!videoReady}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              📷 Capture Photo
            </button>
            <button
              onClick={cancelCamera}
              className="px-6 py-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-all font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ===============================
          Image Preview + Status
      =============================== */}
      {selectedImage && (
        <div className="flex flex-col items-center">
          <img
            src={selectedImage}
            alt="Selected nutrition label"
            className="max-w-md border-2 border-indigo-200 rounded-lg shadow-lg p-2 mt-2"
          />

          {analyzing && (
            <div className="mt-6 flex flex-col items-center space-y-3">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  Analyzing ingredients...
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Extracting ingredients label information
              </p>
            </div>
          )}

          {!analyzing && !error && (
            <button
              onClick={handleUploadNew}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-500 to-green-400 text-white rounded-full hover:shadow-md transition-all font-semibold"
            >
              Upload New Image
            </button>
          )}
        </div>
      )}
    </div>
  );
}