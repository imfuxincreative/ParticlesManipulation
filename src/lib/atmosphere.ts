import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as THREE from "three";

export type Vec3Tuple = [number, number, number];
export type AtmosphereQuality = "high" | "low";

export interface SkyColorKeyframe {
  id: string;
  frame: number;
  color: string;
}

export interface AtmosphereConfig {
  // Colors (sRGB hex)
  horizonColor: string;     // #b3000a
  enableScrollHorizonColor: boolean; // Scroll-based dynamic horizon color keyframe transition
  horizonColorKeyframes: SkyColorKeyframe[]; // Configurable scroll timeline keyframes
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
  rimIntensity: number;     // 10.0
  rimWhiteMix: number;      // 0.85
  keyFillIntensity: number; // 0.00
  topGlowIntensity: number; // 6.0
  rimPositionOffset: Vec3Tuple;     // default [60, 10, -150]
  keyFillPositionOffset: Vec3Tuple; // default [45, -50, 72]

  // Post
  bloomIntensity: number;   // 0.6
  bloomThreshold: number;   // 0.6
  bloomRadius: number;      // 0.7
  vignetteStrength: number; // 0.75
  vignetteOffset: number;   // 0.25
  grainAmount: number;      // 0.12
  godRays: boolean;         // false
  quality: AtmosphereQuality;

  // Broken Light / Faulty Neon Flicker
  brokenLightEnabled: boolean;
  brokenLightIntensity: number;       // 0.0 - 1.0 (depth of blackout drops, default 0.90)
  brokenLightSpeed: number;           // 0.2 - 3.0 (event frequency, default 1.0)
  brokenLightSurge: number;           // 1.1 - 2.5 (overvoltage spike brightness, default 1.85)
  brokenLightScope: BrokenLightScope; // "inTouch" | "all"
  brokenLightStyle: BrokenLightStyle; // "faulty_neon" | "fluorescent_arc" | "erratic_strobe" | "electrical_short"
}

export type BrokenLightStyle = "faulty_neon" | "fluorescent_arc" | "erratic_strobe" | "electrical_short";
export type BrokenLightScope = "inTouch" | "all";

export const DEFAULT_SKY_KEYFRAMES: SkyColorKeyframe[] = [
  { id: "kf-1", frame: -493, color: "#FF000D" },
  { id: "kf-2", frame: 2800, color: "#fb00ff" },
  { id: "kf-3", frame: 8347, color: "#00ff11" },
];

export const REFERENCE_PRESET: AtmosphereConfig = {
  horizonColor: "#FF000D",
  enableScrollHorizonColor: true,
  horizonColorKeyframes: DEFAULT_SKY_KEYFRAMES,
  zenithColor: "#FF0000",
  glowColor: "#FF0000",
  decoupleFog: true,
  fogColorOverride: "#E70D18",

  fogEnabled: true,
  fogDensity: 0.003,
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
  cloudCoverage: 0.60,

  ambientIntensity: 0.25,
  buildingContrast: 1.0,
  rimIntensity: 10.0,
  rimWhiteMix: 0.85,
  keyFillIntensity: 0.00,
  topGlowIntensity: 6.0,
  rimPositionOffset: [60, 10, -150],
  keyFillPositionOffset: [45, -50, 72],

  bloomIntensity: 0.6,
  bloomThreshold: 0.6,
  bloomRadius: 0.7,
  vignetteStrength: 0.75,
  vignetteOffset: 0.25,
  grainAmount: 0.23,
  godRays: false,
  quality: "high",

  brokenLightEnabled: true,
  brokenLightIntensity: 0.90,
  brokenLightSpeed: 1.0,
  brokenLightSurge: 1.85,
  brokenLightScope: "inTouch",
  brokenLightStyle: "faulty_neon",
};

const tempLerpC1 = new THREE.Color();
const tempLerpC2 = new THREE.Color();

/**
 * Calculates smooth linear-space color interpolation between scroll keyframes based on current Blender frame.
 */
export function getInterpolatedHorizonColor(
  keyframes: SkyColorKeyframe[],
  currentFrame: number,
  targetColorOut?: THREE.Color
): THREE.Color {
  const out = targetColorOut || new THREE.Color();
  if (!keyframes || keyframes.length === 0) {
    out.set("#FF000D").convertSRGBToLinear();
    return out;
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (currentFrame <= sorted[0].frame) {
    out.set(sorted[0].color).convertSRGBToLinear();
    return out;
  }

  if (currentFrame >= sorted[sorted.length - 1].frame) {
    out.set(sorted[sorted.length - 1].color).convertSRGBToLinear();
    return out;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i + 1];
    if (currentFrame >= k1.frame && currentFrame <= k2.frame) {
      const range = k2.frame - k1.frame;
      const rawT = range > 0 ? (currentFrame - k1.frame) / range : 0;
      const clampedT = Math.max(0, Math.min(1, rawT));
      // Smoothstep easing curve for ultra smooth visual transitions: t * t * (3 - 2 * t)
      const t = clampedT * clampedT * (3 - 2 * clampedT);

      tempLerpC1.set(k1.color).convertSRGBToLinear();
      tempLerpC2.set(k2.color).convertSRGBToLinear();

      tempLerpC1.lerp(tempLerpC2, t);
      out.copy(tempLerpC1);
      return out;
    }
  }

  out.set(sorted[0].color).convertSRGBToLinear();
  return out;
}

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
  addHorizonKeyframe: (kf?: Partial<SkyColorKeyframe>) => void;
  updateHorizonKeyframe: (id: string, updates: Partial<SkyColorKeyframe>) => void;
  removeHorizonKeyframe: (id: string) => void;
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
      addHorizonKeyframe: (kf) =>
        set((state) => {
          const currentKfs = state.horizonColorKeyframes || DEFAULT_SKY_KEYFRAMES;
          const sorted = [...currentKfs].sort((a, b) => a.frame - b.frame);
          const lastFrame = sorted.length > 0 ? sorted[sorted.length - 1].frame + 500 : 1000;
          const newKf: SkyColorKeyframe = {
            id: "kf-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            frame: kf?.frame ?? lastFrame,
            color: kf?.color ?? "#00ffff",
          };
          return {
            ...state,
            horizonColorKeyframes: [...currentKfs, newKf],
          };
        }),
      updateHorizonKeyframe: (id, updates) =>
        set((state) => ({
          ...state,
          horizonColorKeyframes: (state.horizonColorKeyframes || DEFAULT_SKY_KEYFRAMES).map((kf) =>
            kf.id === id ? { ...kf, ...updates } : kf
          ),
        })),
      removeHorizonKeyframe: (id) =>
        set((state) => ({
          ...state,
          horizonColorKeyframes: (state.horizonColorKeyframes || DEFAULT_SKY_KEYFRAMES).filter((kf) => kf.id !== id),
        })),
    }),
    {
      name: "crimson-atmosphere",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);

