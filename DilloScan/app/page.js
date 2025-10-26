"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

const ImageUpload = dynamic(() => import("./components/Image"), { ssr: false });
const IngredientList = dynamic(() => import("./components/ingredients"), { ssr: false });
const Chatbot = dynamic(() => import("./components/chatbot"), { ssr: false });

export default function Home() {
  const [activeTab, setActiveTab] = useState("image");
  const [analysisData, setAnalysisData] = useState(null);

  useEffect(() => {
    const handleSwitch = (e) => setActiveTab(e.detail);
    window.addEventListener("switchTab", handleSwitch);
    return () => window.removeEventListener("switchTab", handleSwitch);
  }, []);

  // 🧱 Prevent focus-based scroll jumps globally
  useEffect(() => {
    const preventFocusScroll = () => {
      const x = window.scrollX;
      const y = window.scrollY;
      requestAnimationFrame(() => window.scrollTo(x, y));
    };

    window.addEventListener("focusin", preventFocusScroll);
    return () => window.removeEventListener("focusin", preventFocusScroll);
  }, []);

  const tabs = [
    { id: "image", label: "Scan Label" },
    { id: "ingredients", label: "Your Ingredients" },
    { id: "chat", label: "Health Chat" },
  ];

  // ✅ Updated to prevent auto-switch on error
  const handleIngredientsAnalyzed = (data) => {
    setAnalysisData(data);
    // Only auto-switch to ingredients tab if analysis was successful
    if (data && data.success) {
      // Save scroll position before switching
      const currentScroll = window.scrollY;
      setActiveTab("ingredients");
      requestAnimationFrame(() => window.scrollTo(0, currentScroll));
    }
    // If data is null or has an error, stay on the image tab
  };

  const handleTabClick = (tabId) => {
    // Save current scroll position
    const x = window.scrollX;
    const y = window.scrollY;

    // Temporarily freeze the viewport
    const html = document.documentElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevScrollBehavior = html.style.scrollBehavior;

    body.style.overflow = "hidden";
    html.style.scrollBehavior = "auto";

    // Switch tab
    setActiveTab(tabId);

    // Restore position + unlock scroll after reflow
    requestAnimationFrame(() => {
      window.scrollTo(x, y);
      setTimeout(() => {
        window.scrollTo(x, y);
        body.style.overflow = prevOverflow;
        html.style.scrollBehavior = prevScrollBehavior;
      }, 120);
    });
  };

  return (
    <>
      {/* ================================
          Hero Section
      ================================ */}
      <section className="relative text-center py-15 sm:py-15 overflow-visible">
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-0" />
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute left-1/2 top-[-150px] -translate-x-1/2 w-[900px] h-[900px] bg-gradient-to-tr from-indigo-100 via-blue-50 to-green-100 opacity-80 blur-[120px]" />
        </div>

        <div className="relative z-10">
          <h2 className="text-6xl sm:text-7xl font-extrabold leading-[1.15] text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-500 to-green-500 animate-fade-in-up">
            Scan Ingredients.
            <br />Discover Insights.
          </h2>

          <p className="mt-6 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-lg animate-fade-in-up">
            Curl up in safety. Just as an armadillo's shell defends its body while its nose reveals the unseen, Scanadillo protects you by sensing dangers buried deep within the ingredients lists of your favorite snacks, personal hygiene products, and cosmetics.
          </p>

          {/* Tabs */}
          <div className="mt-10 flex justify-center gap-4 flex-wrap animate-fade-in-up relative z-20">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.preventDefault();
                  // Prevent automatic scroll when switching tabs
                  const currentScroll = window.scrollY;
                  handleTabClick(tab.id);
                  requestAnimationFrame(() => window.scrollTo(0, currentScroll));
                }}
                className={`px-7 py-3 rounded-full text-base font-semibold transition-all duration-300 
                ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-indigo-500 to-green-400 text-white shadow-lg"
                    : "bg-white text-gray-700 border border-gray-200 hover:shadow-md"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-[-20px] right-20 w-[180px] md:w-[220px] opacity-95 pointer-events-none">
          <Image
            src="/armadillos/armadillo_laying.png"
            alt="Resting armadillo mascot"
            width={220}
            height={120}
          />
        </div>
      </section>

      {/* ================================
          Main Content
      ================================ */}
      <section className="relative max-w-5xl mx-auto mt-20 mb-32 px-6" id="features">
        {activeTab !== "chat" ? (
          <div className="glass p-10 rounded-3xl shadow-xl animate-fade-in-up">
            {activeTab === "image" && (
              <div id="scan-section">
                <h3 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-green-500">
                  Image Scanner
                </h3>
                <ImageUpload onIngredientsAnalyzed={handleIngredientsAnalyzed} />
              </div>
            )}

            {activeTab === "ingredients" && (
              <div id="ingredients-section">
                <h3 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-green-500">
                  Ingredients Overview
                </h3>
                {analysisData && analysisData.success ? (
                  <IngredientList analysisData={analysisData} />
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                      No ingredients detected yet. Upload an image to begin.
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleTabClick("image");
                      }}
                      className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:shadow-md transition-all font-semibold"
                    >
                      Go to Image Scanner
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div id="chat-section" className="animate-fade-in-up mt-4">
            <Chatbot
              ingredients={analysisData?.ingredients || []}
              analysisData={analysisData}
            />
          </div>
        )}
      </section>

      {/* ================================
          Footer
      ================================ */}
      <footer className="relative w-full border-t border-gray-200 bg-white/60 backdrop-blur-md py-6 mt-20">
        <div className="max-w-5xl mx-auto flex justify-center items-center">
          <p className="text-sm text-gray-600">
            Made with love by{" "}
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-green-500">
              Team Gatordillos
            </span>
          </p>
        </div>

        <div className="absolute bottom-0 right-6 md:right-10 w-[140px] opacity-95 pointer-events-none">
          <Image
            src="/armadillos/armadillo_sitting.png"
            alt="Footer armadillo mascot"
            width={140}
            height={140}
          />
        </div>
      </footer>
    </>
  );
}