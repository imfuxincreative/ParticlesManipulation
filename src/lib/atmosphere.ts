import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as THREE from "three";

export type Vec3Tuple = [number, number, number];
export type AtmosphereQuality = "high" | "low";

export interface AtmosphereConfig {
  // Colors (sRGB hex)
  horizonColor: string;     // #b3000a
  zenithColor: string;      // #3a0004
  glowColor: string;        // #ff1a1a
  decoupleFog: boolean;     // false
  fogColorOverride: string; // used when decoupleFog === true

  // Fog
  fogEnabled: boolean;
  fogDensity: number;       // 0.012
  fogHeightFalloff: number; // 0.04
  fogHeightBase: number;    // 0

  // Distance Opacity Depth Fade
  farFadeEnabled: boolean;
  farFadeStart: number;     // Distance (u) where opacity fade begins
  farFadeEnd: number;       // Distance (u) where opacity drops to minimum
  farMinOpacity: number;    // 0.0 = completely transparent far objects

  // Sky
  skyEnabled: boolean;
  skyExposure: number;      // 1.0 (clamped 0.5–1.5)
  glowStrength: number;     // 0.55
  glowMode: "tracked" | "fixed";
  glowDirection: Vec3Tuple; // used when fixed; tracked = normalize(heroTop - camPos)
  cloudScale: number;       // 1.4
  cloudSpeed: number;       // 0.015
  cloudContrast: number;    // 1.3
  cloudCoverage: number;    // 0 = no clouds, 1 = overcast

  // Lighting
  ambientIntensity: number; // 0.25
  buildingContrast: number; // 1.0 (clamped 0.2–3.0)
  rimIntensity: number;     // 4.0
  rimWhiteMix: number;      // 0.45
  keyFillIntensity: number; // 0.35
  topGlowIntensity: number; // 6.0

  // Post
  bloomIntensity: number;   // 0.6
  bloomThreshold: number;   // 0.6
  bloomRadius: number;      // 0.7
  vignetteStrength: number; // 0.75
  vignetteOffset: number;   // 0.25
  grainAmount: number;      // 0.12
  godRays: boolean;         // false
  quality: AtmosphereQuality;
}

export const REFERENCE_PRESET: AtmosphereConfig = {
  horizonColor: "#FF000D",
  zenithColor: "#4D0000",
  glowColor: "#FF0000",
  decoupleFog: true,
  fogColorOverride: "#E70D18",

  fogEnabled: true,
  fogDensity: 0.008,
  fogHeightFalloff: 0.02,
  fogHeightBase: 8,

  farFadeEnabled: true,
  farFadeStart: 250,
  farFadeEnd: 1400,
  farMinOpacity: 0.0,

  skyEnabled: true,
  skyExposure: 1.50,
  glowStrength: 0.30,
  glowMode: "fixed",
  glowDirection: [0, 0.5, -1],
  cloudScale: 2.2,
  cloudSpeed: 0.04,
  cloudContrast: 2.2,
  cloudCoverage: 0.35,

  ambientIntensity: 0.25,
  buildingContrast: 1.0,
  rimIntensity: 4.0,
  rimWhiteMix: 0.45,
  keyFillIntensity: 0.35,
  topGlowIntensity: 6.0,

  bloomIntensity: 0.6,
  bloomThreshold: 0.6,
  bloomRadius: 0.7,
  vignetteStrength: 0.75,
  vignetteOffset: 0.25,
  grainAmount: 0.12,
  godRays: false,
  quality: "high",
};

/**
 * Derive the fog color hex. In linear space, fog is 85% horizon + 15% zenith unless decoupled.
 */
export function deriveFogColorHex(c: Pick<AtmosphereConfig, "horizonColor" | "zenithColor" | "decoupleFog" | "fogColorOverride">): string {
  if (c.decoupleFog) return c.fogColorOverride;

  const h = new THREE.Color(c.horizonColor).convertSRGBToLinear();
  const z = new THREE.Color(c.zenithColor).convertSRGBToLinear();
  const fogLinear = h.lerp(z, 0.15);
  return "#" + fogLinear.convertLinearToSRGB().getHexString();
}

/**
 * TS mirror of GLSL atmosphereFactor for debugging and test suite.
 */
export function computeFogFactor(viewDist: number, worldY: number, c: AtmosphereConfig): number {
  if (!c.fogEnabled) return 0;
  const distFog = 1.0 - Math.exp(-Math.pow(viewDist * c.fogDensity, 1.6));
  const h = Math.max(worldY - c.fogHeightBase, 0.0);
  const heightFog = Math.exp(-h * c.fogHeightFalloff);
  const factor = distFog * (1.0 * (1.0 - 0.65) + heightFog * 0.65);
  return Math.min(Math.max(factor, 0.0), 1.0);
}

function detectQuality(): AtmosphereQuality {
  if (typeof window === "undefined") return "high";
  const nav = window.navigator as any;
  const cores = nav?.hardwareConcurrency || 8;
  const mem = nav?.deviceMemory || 8;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(nav?.userAgent || "");
  if (cores <= 4 || mem <= 4 || isMobile) {
    return "low";
  }
  return "high";
}

interface AtmosphereActions {
  set: <K extends keyof AtmosphereConfig>(k: K, v: AtmosphereConfig[K]) => void;
  applyPreset: (p?: AtmosphereConfig) => void;
  setHeroTopPosition: (pos: Vec3Tuple) => void;
  heroTopPosition: Vec3Tuple;
}

export const useAtmosphere = create<AtmosphereConfig & AtmosphereActions>()(
  persist(
    (set) => ({
      ...REFERENCE_PRESET,
      quality: detectQuality(),
      heroTopPosition: [0, 25, -40],
      set: (k, v) => set((state) => ({ ...state, [k]: v })),
      applyPreset: (p = REFERENCE_PRESET) => set((state) => ({ ...state, ...p })),
      setHeroTopPosition: (pos) => set((state) => ({ ...state, heroTopPosition: pos })),
    }),
    {
      name: "crimson-atmosphere",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
