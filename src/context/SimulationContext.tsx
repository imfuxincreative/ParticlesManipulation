"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type PresetType = "neon" | "muted" | "volcanic" | "monochrome" | "emerald";

export interface SimulationSettings {
  gridSize: 128 | 192 | 256 | 384 | 512 | 768 | 1024 | 1536 | 2048;
  glitchIntensity: number;
  glitchInterval: number;
  glitchDuration: number;
  bgGlitchIntensity: number;
  bgGlitchInterval: number;
  bgGlitchDuration: number;
  scatterRadius: number;
  scatterStrength: number;
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
  models: string[];
  currentModelIndex: number;
  isPlaying: boolean;
  activePreset: PresetType;
}

const PRESETS: Record<PresetType, Partial<SimulationSettings>> = {
  neon: {
    hazeColor: "#ffffff",
    tintColor: "#a855f7", // Violet
    tintMix: 0.1, // Drastically reduced to preserve original video color
    glitchIntensity: 0.2,
    glitchInterval: 2.0,
    glitchDuration: 0.3,
    bgGlitchIntensity: 2.0,
    bgGlitchInterval: 3.0,
    bgGlitchDuration: 0.2,
    noiseStrength: 0.35,
    noiseSpeed: 0.6,
    hazeDensity: 0.4,
    bokehScale: 5.0,
  },
  muted: {
    hazeColor: "#0b0c10",
    tintColor: "#4fd1c5", // Teal
    tintMix: 0.1, // Drastically reduced
    glitchIntensity: 0.0,
    glitchInterval: 3.0,
    glitchDuration: 0.2,
    noiseStrength: 0.2,
    noiseSpeed: 0.3,
    hazeDensity: 0.3,
    bokehScale: 3.5,
  },
  volcanic: {
    hazeColor: "#0d0505",
    tintColor: "#f97316", // Orange
    tintMix: 0.2, // Reduced
    glitchIntensity: 0.5,
    glitchInterval: 1.5,
    glitchDuration: 0.5,
    noiseStrength: 0.5,
    noiseSpeed: 0.9,
    hazeDensity: 0.5,
    bokehScale: 6.0,
  },
  monochrome: {
    hazeColor: "#0a0a0a",
    tintColor: "#ffffff", // White
    tintMix: 0.0,
    glitchIntensity: 0.1,
    glitchInterval: 2.5,
    glitchDuration: 0.3,
    noiseStrength: 0.15,
    noiseSpeed: 0.2,
    hazeDensity: 0.7,
    bokehScale: 4.0,
  },
  emerald: {
    hazeColor: "#020804",
    tintColor: "#10b981", // Emerald
    tintMix: 0.1,
    glitchIntensity: 0.0,
    glitchInterval: 3.0,
    glitchDuration: 0.2,
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
}

const defaultSettings: SimulationSettings = {
  gridSize: 512, // Massive density (4 million+ particles) for a completely solid, clear image
  glitchIntensity: 1.0, // Base glitch burst strength
  glitchInterval: 2.0, // Calm period base (seconds)
  glitchDuration: 0.4, // Active burst base (seconds)
  bgGlitchIntensity: 1.0,
  bgGlitchInterval: 3.0,
  bgGlitchDuration: 0.3,
  scatterRadius: 2.0,
  scatterStrength: 3.0,
  noiseStrength: 0.1, // Reduced so the footage is clearer and less warped
  noiseSpeed: 0.4,
  pointSize: .5, // Increased to 2.5px to make particles thicker and improve clarity
  focusDepth: 14.0,
  focusRange: 2.0,
  bokehScale: 4.0,
  hazeColor: "#ffffff",
  hazeDensity: 0.1,
  tintColor: "#a855f7",
  tintMix: 0.0,
  opacity: 1.0, // Full opacity for clear footage
  densityControl: 0.0, // Turned off particle dropping so the entire video renders cleanly
  models: ["/model.glb", "/bird.glb"],
  currentModelIndex: 0,
  isPlaying: false,
  activePreset: "neon",
};

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SimulationSettings>(defaultSettings);

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

  return (
    <SimulationContext.Provider
      value={{
        settings,
        updateSetting,
        applyPreset,
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
