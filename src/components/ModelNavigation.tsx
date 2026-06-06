"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

export const ModelNavigation: React.FC = () => {
  const { settings, updateSetting } = useSimulation();
  
  const handleNext = () => {
    const nextIndex = (settings.currentModelIndex + 1) % settings.models.length;
    updateSetting("currentModelIndex", nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = (settings.currentModelIndex - 1 + settings.models.length) % settings.models.length;
    updateSetting("currentModelIndex", prevIndex);
  };

  // Only show if there are multiple models
  if (settings.models.length <= 1) return null;

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-10 pointer-events-none flex items-center justify-between px-8">
      <button 
        onClick={handlePrev}
        className="pointer-events-auto p-4 bg-slate-900/50 hover:bg-purple-600/50 backdrop-blur-md rounded-full border border-slate-700/50 text-slate-300 hover:text-white transition-all duration-300 transform hover:scale-110 active:scale-95"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      <button 
        onClick={handleNext}
        className="pointer-events-auto p-4 bg-slate-900/50 hover:bg-purple-600/50 backdrop-blur-md rounded-full border border-slate-700/50 text-slate-300 hover:text-white transition-all duration-300 transform hover:scale-110 active:scale-95"
      >
        <ChevronRight className="w-8 h-8" />
      </button>
    </div>
  );
};
