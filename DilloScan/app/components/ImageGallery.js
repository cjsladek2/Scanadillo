"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ImageGallery({ scanHistory = [], onScanSelect }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (scanHistory.length > 0) {
      setCurrentIndex(scanHistory.length - 1); // show latest by default
    }
  }, [scanHistory]);

  if (!scanHistory || scanHistory.length === 0) {
    return (
      <div className="text-gray-400 text-sm mt-6">
        No previous scans yet — upload or capture one to begin!
      </div>
    );
  }

  const currentScan = scanHistory[currentIndex];
  const handlePrev = () =>
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : scanHistory.length - 1));
  const handleNext = () =>
    setCurrentIndex((prev) => (prev + 1) % scanHistory.length);

  useEffect(() => {
    if (currentScan) onScanSelect(currentScan);
  }, [currentIndex]);

  return (
    <div className="flex flex-col items-center mt-4 space-y-3">
      {/* Image with arrows */}
      <div className="relative">
        <img
          src={currentScan.image}
          alt="Previous scan"
          className="max-h-80 rounded-lg border-4 border-indigo-100 shadow-md object-contain"
        />
        {scanHistory.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-[-2.5rem] top-1/2 transform -translate-y-1/2
              bg-white/80 hover:bg-white rounded-full p-2 shadow-md"
            >
              <ChevronLeft className="w-6 h-6 text-indigo-600" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-[-2.5rem] top-1/2 transform -translate-y-1/2
              bg-white/80 hover:bg-white rounded-full p-2 shadow-md"
            >
              <ChevronRight className="w-6 h-6 text-indigo-600" />
            </button>
          </>
        )}
      </div>

      {/* Image Counter */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Scan {currentIndex + 1} of {scanHistory.length}
      </p>
    </div>
  );
}
