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
  gridFloorFallRadius: number;
  gridFloorFallRadiusRange: number;
  gridFloorFallMaxDistance: number;
  gridFloorFallRandomness: number;
  showSky: boolean;
  skyColor: string;
  skyExposure: number;
  skyHorizonRange: number;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
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
  modelFlowSpeed: number;
  modelFlowStrength: number;
  modelFlowFrequency: number;
  modelFlowNormalLimit: number;
  modelScatterColorScale: number;
  modelFlowClumping: number;
  fluidDragRadius: number;
  fluidDragStrength: number;
  fluidDamping: number;
  fluidSpiralSuppression: number;
  fluidRadialExpansion: number;
  fluidTurbulenceSwirl: number;
  fluidDirectionalBias: number;
  burnSensitivity: number;
  burnThreshold: number;
  burnExponent: number;
  burnMidThreshold: number;
  burnMaxThreshold: number;
  burnColorPrimary: string;
  burnColorSecondary: string;
  cityHologramOpacity: number;
  scrollSpeed: number;
  scrollDamping: number;
  enableScrollSnap: boolean;
  scrollSnapDuration: number;
  scrollSnapThreshold: number;
  modelOffsetX: number;
  modelOffsetY: number;
  modelOffsetZ: number;
  modelScale: number;
  modelAutoRotateSpeedX: number;
  modelBaseRotationX: number;
  modelBaseRotationY: number;
  modelBaseRotationZ: number;
  loaderModelScale: number;
  loaderBurnSensitivity: number;
  loaderMorphSpeed: number;
  alwaysShowLoader: boolean;
  showGhibliGrass: boolean;
  useRealisticGrass: boolean;
  ghibliGrassCount: number;
  ghibliGrassHeight: number;
  ghibliGrassWidth: number;
  ghibliGrassRadius: number;
  ghibliGrassWindSpeed: number;
  ghibliGrassWindStrength: number;
  ghibliGrassRevealDistance: number;
  ghibliGrassRevealSoftness: number;
  ghibliGrassRevealOffset: number;
  showGhibliFlowers: boolean;
  ghibliFlowerCount: number;
  ghibliFlowerScale: number;
  showGhibliTrees: boolean;
  ghibliPaletteKey: string;
  groundColor: string;
  groundOpacity: number;
  // Flying Cars Traffic
  enableFlyingCars: boolean;
  flyingCarsBaseSpeed: number;
  flyingCarsSpeedVariance: number;
  flyingCarsMaxDistance: number;
  flyingCarsHoverBobbing: boolean;
  flyingCarsBobbingStrength: number;
  invertFlyingCarsDirection: boolean;
  // Particle Audio & Motion Sound
  particleSoundEnabled: boolean;
  particleSoundVolume: number;
  particleIdleVolume: number;
  particleAmbientVolume: number;
  particleSoundPreset: "velvet" | "tactile" | "stardust" | "plasma";
  particleSoundPitch: number;
  particleSoundShimmer: number;
  particleSoundRoughness: number;
  particleCollisionSensitivity: number;
  particleMotionSensitivity: number;
  particleOnsetStrength: number;
  particleAudioNearDistance: number;
  particleAudioFarDistance: number;
  particleTactileTexture: number;
  particleTactilePitch: number;
  particleTactileResonance: number;
  particleTactileSnap: number;
  particleCollisionRadius: number;
  particleRepulsionStrength: number;
  carLedIntensity: number;
  carLedColor: string;
  carLedPulse: boolean;
  carLedPulseSpeed: number;
  tvScreenIntensity: number;
  tvScreenColor: string;
  tvScreenFlicker: boolean;
  tvScreenScanlines: boolean;
  tvScreenMode: "shader" | "native";
  isLoading: boolean;
  isSceneLoaded: boolean;
  sceneLoadProgress: number;
}

interface SimulationContextProps {
  settings: SimulationSettings;
  updateSetting: <K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => void;
  updateSettings: (newSettings: Partial<SimulationSettings>) => void;
  triggerSceneEntrance: () => void;
}

const defaultSettings: SimulationSettings = {
  gridSize: 512,
  particleDefaultColor: "#ffffff",
  glitchIntensity: 0,
  glitchInterval: 0,
  glitchDuration: 0,
  bgGlitchIntensity: 0,
  bgGlitchInterval: 0,
  bgGlitchDuration: 0,
  scatterRadius: 2,
  scatterStrength: 3,
  noiseStrength: 0.1,
  noiseSpeed: 0.4,
  pointSize: 2.8,
  focusDepth: 14,
  focusRange: 2,
  bokehScale: 4,
  hazeColor: "#1a0505",
  hazeDensity: 0.1,
  tintColor: "#000000",
  tintMix: 0,
  opacity: 1,
  densityControl: 0,
  models: ["/heart.glb", "/bird.glb"],
  currentModelIndex: 0,
  isPlaying: false,
  xrayFillOpacity: 0.38,
  xrayOutlineColor: "#ffffff",
  xrayBaseColor: "#ffffff",
  xrayOutlinePower: 2.5,
  xrayScanlineIntensity: 0.45,
  xrayBorderColor: "#000000",
  xrayBorderOpacity: 0.5,
  xrayBorderThreshold: 15,
  xrayBorderDepthLimit: 20,
  xrayBorderRevealDepth: 1000,
  xraySolidRevealDepth: 110,
  xrayHoverRadius: 10,
  xrayLineGlowIntensity: 2.5,
  showGridFloor: false,
  gridFloorOpacity: 0.35,
  gridFloorFillOpacity: 0.15,
  gridTileSize: 4,
  gridLineWidth: 1.5,
  gridFloorY: -4.5,
  gridFloorFallRadius: 68,
  gridFloorFallRadiusRange: 11,
  gridFloorFallMaxDistance: 5,
  gridFloorFallRandomness: 50,
  showSky: true,
  skyColor: "#ff0000",
  skyExposure: 1.0,
  skyHorizonRange: -0.8,
  ambientLightIntensity: 0.3,
  directionalLightIntensity: 1.4,
  wingStartMode: "spine",
  showWingAnchor: false,
  wingFlowFrequency: 1,
  wingFlowStrength: 0.2,
  wingGlowIntensity: 1.5,
  simonGlowIntensity: 0.0,
  simonBloomIntensity: 2.0,
  simonGlowColor: "#ffffff",
  simonGlowOpacity: 1.0,
  titleSize: 8,
  titleYOffset: -0.5,
  showWings: false,
  showFog: true,
  fogColor: "#b30000",
  fogNear: 40,
  fogFar: 350,
  fogAmount: 1,
  modelFlowSpeed: 0.15,
  modelFlowStrength: 0.15,
  modelFlowFrequency: 1.15,
  modelFlowNormalLimit: 0,
  modelScatterColorScale: 0.41,
  modelFlowClumping: 0,
  fluidDragRadius: 5.0,
  fluidDragStrength: 0.7,
  fluidDamping: 0.8,
  fluidSpiralSuppression: 1,
  fluidRadialExpansion: 0.15,
  fluidTurbulenceSwirl: 0.35,
  fluidDirectionalBias: 0.65,
  burnSensitivity: 2.3,
  burnThreshold: 0.08,
  burnExponent: 1.5,
  burnMidThreshold: 0.25,
  burnMaxThreshold: 0.7,
  burnColorPrimary: "#000000",
  burnColorSecondary: "#000000",
  cityHologramOpacity: 0.84,
  scrollSpeed: 0.5,
  scrollDamping: 0.05,
  enableScrollSnap: true,
  scrollSnapDuration: 2.2,
  scrollSnapThreshold: 0.2,
  modelOffsetX: 0,
  modelOffsetY: 0,
  modelOffsetZ: 0,
  modelScale: 5.2,
  modelAutoRotateSpeedX: 0.3,
  modelBaseRotationX: -1.5707963267948966,
  modelBaseRotationY: 0,
  modelBaseRotationZ: 1.5,
  loaderModelScale: 0.27,
  loaderBurnSensitivity: 2,
  loaderMorphSpeed: 0.06,
  alwaysShowLoader: false,
  showGhibliGrass: true,
  useRealisticGrass: true,
  ghibliGrassCount: 930000,
  ghibliGrassHeight: 2.7,
  ghibliGrassWidth: 0.3,
  ghibliGrassRadius: 90,
  ghibliGrassWindSpeed: 1.2,
  ghibliGrassWindStrength: 0.3,
  ghibliGrassRevealDistance: 710,
  ghibliGrassRevealSoftness: 100,
  ghibliGrassRevealOffset: 0,
  showGhibliFlowers: true,
  ghibliFlowerCount: 12000,
  ghibliFlowerScale: 1.2,
  showGhibliTrees: true,
  ghibliPaletteKey: "obsidian",
  groundColor: "#000000",
  groundOpacity: 1.0,
  enableFlyingCars: true,
  flyingCarsBaseSpeed: 35,
  flyingCarsSpeedVariance: 0.35,
  flyingCarsMaxDistance: 800,
  flyingCarsHoverBobbing: true,
  flyingCarsBobbingStrength: 0.8,
  invertFlyingCarsDirection: false,
  particleSoundEnabled: true,
  particleSoundVolume: 0.35,
  particleIdleVolume: 0.025,
  particleAmbientVolume: 0.025,
  particleSoundPreset: "velvet",
  particleSoundPitch: 0.8,
  particleSoundShimmer: 0.6,
  particleSoundRoughness: 0.5,
  particleCollisionSensitivity: 0.5,
  particleMotionSensitivity: 0.5,
  particleOnsetStrength: 0.0,
  particleAudioNearDistance: 25.0,
  particleAudioFarDistance: 120.0,
  particleTactileTexture: 0.35,
  particleTactilePitch: 400,
  particleTactileResonance: 10.0,
  particleTactileSnap: 1.4,
  particleCollisionRadius: 0.05,
  particleRepulsionStrength: 0.35,
  carLedIntensity: 3.5,
  carLedColor: "#00f0ff",
  carLedPulse: true,
  carLedPulseSpeed: 2.5,
  tvScreenIntensity: 3.5,
  tvScreenColor: "#ffffff",
  tvScreenFlicker: true,
  tvScreenScanlines: true,
  tvScreenMode: "shader",
  isLoading: true,
  isSceneLoaded: false,
  sceneLoadProgress: 0,
};

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SimulationSettings>(defaultSettings);

  const updateSetting = useCallback(<K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const triggerSceneEntrance = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      cityHologramOpacity: 0.0,
      xrayBorderRevealDepth: 0.0,
    }));

    const startTime = performance.now();
    const duration = 1800;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      setSettings((prev) => ({
        ...prev,
        cityHologramOpacity: 0.10 * ease,
        xrayBorderRevealDepth: 1000.0 * ease,
      }));

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
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
        triggerSceneEntrance,
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
