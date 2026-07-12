"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface SimulationSettings {
  gridSize: 128 | 192 | 256 | 384 | 512 | 768 | 1024 | 1536 | 2048;
  particleDefaultColor: string;
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
  xrayFillOpacity: number;
  xrayOutlineColor: string;
  xrayBaseColor: string;
  xrayOutlinePower: number;
  xrayScanlineIntensity: number;
  xrayBorderColor: string;
  xrayBorderOpacity: number;
  xrayBorderThreshold: number;
  xrayBorderDepthLimit: number;
  xrayBorderRevealDepth: number;
  xraySolidRevealDepth: number;
  xrayHoverRadius: number;
  xrayLineGlowIntensity: number;
  showGridFloor: boolean;
  gridFloorOpacity: number;
  gridFloorFillOpacity: number;
  gridTileSize: number;
  gridLineWidth: number;
  gridFloorY: number;
  showSky: boolean;
  skyColor: string;
  skyExposure: number;
  skyHorizonRange: number;
  wingStartMode: "spine" | "formed" | "scattered";
  showWingAnchor: boolean;
  wingFlowFrequency: number;
  wingFlowStrength: number;
  wingGlowIntensity: number;
  simonGlowIntensity: number;
  simonBloomIntensity: number;
  simonGlowColor: string;
  simonGlowOpacity: number;
  titleSize: number;
  titleYOffset: number;
  showWings: boolean;
  showFog: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  fogAmount: number;
}

interface SimulationContextProps {
  settings: SimulationSettings;
  updateSetting: <K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => void;
  updateSettings: (newSettings: Partial<SimulationSettings>) => void;
}

const defaultSettings: SimulationSettings = {
  gridSize: 512, // Massive density (4 million+ particles) for a completely solid, clear image
  particleDefaultColor: "#ffffff",
  glitchIntensity: 0.0, // Base glitch burst strength
  glitchInterval: 0.0, // Calm period base (seconds)
  glitchDuration: 0.0, // Active burst base (seconds)
  bgGlitchIntensity: 0.0,
  bgGlitchInterval: 0.0,
  bgGlitchDuration: 0.0,
  scatterRadius: 2.0,
  scatterStrength: 3.0,
  noiseStrength: 0.1, // Reduced so the footage is clearer and less warped
  noiseSpeed: 0.4,
  pointSize: 9.0, // Increased to 2.5px to make particles thicker and improve clarity
  focusDepth: 14.0,
  focusRange: 2.0,
  bokehScale: 4.0,
  hazeColor: "#ffffff",
  hazeDensity: 0.1,
  tintColor: "#a855f7",
  tintMix: 0.0,
  opacity: 1.0, // Full opacity for clear footage
  densityControl: 0.0, // Turned off particle dropping so the entire video renders cleanly
  models: ["/bird.glb", "/figure.glb"],
  currentModelIndex: 0,
  isPlaying: false,
  xrayFillOpacity: 0.15,
  xrayOutlineColor: "#ffffff",
  xrayBaseColor: "#888888",
  xrayOutlinePower: 2.5,
  xrayScanlineIntensity: 0.0,
  xrayBorderColor: "#e91e63",
  xrayBorderOpacity: 0.5,
  xrayBorderThreshold: 15.0,
  xrayBorderDepthLimit: 20.0,
  xrayBorderRevealDepth: 80.0,
  xraySolidRevealDepth: 14.0,
  xrayHoverRadius: 10.0,
  xrayLineGlowIntensity: 2.5,
  showGridFloor: true,
  gridFloorOpacity: 0.35,
  gridFloorFillOpacity: 0.15,
  gridTileSize: 4.0,
  gridLineWidth: 1.5,
  gridFloorY: -4.5,
  showSky: true,
  skyColor: "#ff007f",
  skyExposure: 1.55,
  skyHorizonRange: -1.05,
  wingStartMode: "spine",
  showWingAnchor: false,
  wingFlowFrequency: 1.0,
  wingFlowStrength: 0.200,
  wingGlowIntensity: 1.5,
  simonGlowIntensity: 1.2,
  simonBloomIntensity: 0.4,
  simonGlowColor: "#ffffff",
  simonGlowOpacity: 0.4,
  titleSize: 8.0,
  titleYOffset: -0.5,
  showWings: false,
  showFog: true,
  fogColor: "#ffffff",
  fogNear: 100.0,
  fogFar: 600.0,
  fogAmount: 1.0,
};

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SimulationSettings>(defaultSettings);

  const updateSetting = useCallback(<K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth <= 768;
    if (isMobileUA || isSmallScreen) {
      updateSetting("gridSize", 192);
    }
  }, [updateSetting]);

  const updateSettings = useCallback((newSettings: Partial<SimulationSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  return (
    <SimulationContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
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
