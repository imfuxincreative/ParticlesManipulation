"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type PresetType = "neon" | "muted" | "volcanic" | "monochrome" | "emerald";

export interface SimulationSettings {
  gridSize: 128 | 192 | 256 | 384 | 512 | 768 | 1024 | 1536 | 2048;
  depthScale: number;
  noiseStrength: number;
  noiseSpeed: number;
  pointSize: number;
  focusDepth: number;
  focusRange: number;
  bokehScale: number;
  hazeColor: string;
  hazeDensity: number;
  tintColor: string;
  tintMix: number;
  opacity: number;
  densityControl: number;
  isPlaying: boolean;
  activePreset: PresetType;
  videoUrl: string;
  videoMode: "rgbd" | "normal";
  cameraMode: "scroll" | "orbit";
}

const PRESETS: Record<PresetType, Partial<SimulationSettings>> = {
  neon: {
    hazeColor: "#ffffff",
    tintColor: "#a855f7", // Violet
    tintMix: 0.1, // Drastically reduced to preserve original video color
    depthScale: 8.0,
    noiseStrength: 0.35,
    noiseSpeed: 0.6,
    hazeDensity: 0.4,
    bokehScale: 5.0,
  },
  muted: {
    hazeColor: "#0b0c10",
    tintColor: "#4fd1c5", // Teal
    tintMix: 0.1, // Drastically reduced
    depthScale: 6.0,
    noiseStrength: 0.2,
    noiseSpeed: 0.3,
    hazeDensity: 0.3,
    bokehScale: 3.5,
  },
  volcanic: {
    hazeColor: "#0d0505",
    tintColor: "#f97316", // Orange
    tintMix: 0.2, // Reduced
    depthScale: 10.0,
    noiseStrength: 0.5,
    noiseSpeed: 0.9,
    hazeDensity: 0.5,
    bokehScale: 6.0,
  },
  monochrome: {
    hazeColor: "#0a0a0a",
    tintColor: "#ffffff", // White
    tintMix: 0.0,
    depthScale: 7.0,
    noiseStrength: 0.15,
    noiseSpeed: 0.2,
    hazeDensity: 0.7,
    bokehScale: 4.0,
  },
  emerald: {
    hazeColor: "#020804",
    tintColor: "#10b981", // Emerald
    tintMix: 0.1,
    depthScale: 7.5,
    noiseStrength: 0.3,
    noiseSpeed: 0.5,
    hazeDensity: 0.4,
    bokehScale: 4.5,
  },
};

interface SimulationContextProps {
  settings: SimulationSettings;
  updateSetting: <K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => void;
  applyPreset: (preset: PresetType) => void;
  videoElement: HTMLVideoElement | null;
  setVideoElement: (el: HTMLVideoElement | null) => void;
  scrollPercent: number;
  setScrollPercent: (percent: number) => void;
}

const defaultSettings: SimulationSettings = {
  gridSize: 2048, // Massive density (4 million+ particles) for a completely solid, clear image
  depthScale: 4.0, // Reduced from 7.0 so the image doesn't tear/distort as much in 3D space
  noiseStrength: 0.1, // Reduced so the footage is clearer and less warped
  noiseSpeed: 0.4,
  pointSize: 2.5, // Increased to 2.5px to make particles thicker and improve clarity
  focusDepth: 14.0,
  focusRange: 2.0,
  bokehScale: 4.0,
  hazeColor: "#ffffff",
  hazeDensity: 0.1,
  tintColor: "#a855f7",
  tintMix: 0.0,
  opacity: 1.0, // Full opacity for clear footage
  densityControl: 0.0, // Turned off particle dropping so the entire video renders cleanly
  isPlaying: false,
  activePreset: "neon",
  videoUrl: "/demo_scrub.mp4",
  videoMode: "normal",
  cameraMode: "scroll",
};

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SimulationSettings>(defaultSettings);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [scrollPercent, setScrollPercent] = useState<number>(0);

  const updateSetting = <K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: PresetType) => {
    setSettings((prev) => ({
      ...prev,
      ...PRESETS[preset],
      activePreset: preset,
    }));
  };

  // Keep video play state in sync with setting.isPlaying
  useEffect(() => {
    if (!videoElement) return;

    if (settings.isPlaying) {
      videoElement.play().catch((err) => console.log("Video auto-play blocked or failed:", err));
    } else {
      videoElement.pause();
    }
  }, [settings.isPlaying, videoElement]);

  return (
    <SimulationContext.Provider
      value={{
        settings,
        updateSetting,
        applyPreset,
        videoElement,
        setVideoElement,
        scrollPercent,
        setScrollPercent,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
};
