"use client";

export type ParticleSoundPreset = "velvet" | "tactile" | "stardust" | "plasma";

export interface ParticleSoundSettings {
  enabled: boolean;
  masterVolume: number;        // 0.0 to 1.0 (Master volume multiplier)

  // 1. Tactile Micro-Crackles
  crackleDensity: number;      // 20 to 350 crackles/sec max
  crackleSharpness: number;    // 0.5 to 2.0 (Crisp snap vs soft grain)
  
  // 2. Subtle Granular Velvet Dust (Cloud Body)
  dustVolume: number;          // 0.0 to 1.0 (Soft pink/brownian granular cloud warmth)
  dustToneHz: number;          // 1200 to 4500 Hz (Center frequency of dust body)

  // 3. Delicate High-Frequency Sparkle (Airy Sheen)
  sparkleIntensity: number;    // 0.0 to 1.0 (Crystalline high sheen when moving)
  sparkleFreqHz: number;       // 7000 to 14000 Hz (Sparkle center frequency)

  // 4. Settling Tail & Envelope Dynamics
  tailTime: number;            // 0.05 to 1.2s (Decay tail when particles settle)
  speedSensitivity: number;    // 0.2 to 3.0 (How eagerly velocity drives dynamics)
  volumeCurve: number;         // 0.8 to 2.5 (Volume dynamics exponent)
  attackTime: number;          // 0.005 to 0.05s (Fast attack response)
  releaseTime: number;         // 0.05 to 1.2s (Matches tailTime)
  distanceInfluence: number;   // 0.0 to 1.0 (How displacement thickens texture)

  // Spatial & Proximity
  nearDistance: number;        // World distance for 100% volume
  farDistance: number;         // World distance where audio fades to 0
  
  // UI Diagnostics
  showDebug: boolean;          // Toggle live audio monitor readout HUD

  // Backward compatibility aliases
  textureBlend?: number;
  basePitchHz?: number;
  pitchRangeSemitones?: number;
  brightnessMinHz?: number;
  brightnessMaxHz?: number;
  tickDensity?: number;
  tickSharpness?: number;
  jitter?: number;
  ambientVolume?: number;
  shimmer?: number;
  legacyAirPitch?: number;
}

export interface SoundTelemetry {
  energy: number;              // 0.0 to 1.0
  speedNorm: number;           // 0.0 to 1.0
  densityNorm: number;         // 0.0 to 1.0
  distanceNorm: number;        // 0.0 to 1.0
  grainRate: number;           // Current crackles/sec scheduled
  currentPitchHz: number;      // Effective frequency
  activeVoices: number;        // Active concurrent crackle voices
}

export const DEFAULT_SOUND_SETTINGS: ParticleSoundSettings = {
  enabled: true,
  masterVolume: 0.60,
  crackleDensity: 180,         // 180 crackles/sec during fast scatter
  crackleSharpness: 1.15,      // Crisp, tactile micro-crackles
  dustVolume: 0.42,            // Soft velvet granular dust body
  dustToneHz: 2600,            // Warm velvet midrange
  sparkleIntensity: 0.35,      // Delicate high stardust sheen
  sparkleFreqHz: 9800,         // Airy crystalline sparkle
  tailTime: 0.38,              // 380ms organic settling tail
  speedSensitivity: 1.0,
  volumeCurve: 1.35,           // Quiet on slow drag, expressive on fast swipe
  attackTime: 0.012,           // 12ms quick organic rise
  releaseTime: 0.38,
  distanceInfluence: 0.40,
  nearDistance: 25.0,
  farDistance: 120.0,
  showDebug: false,
};

export const SOUND_PRESETS: Record<ParticleSoundPreset, Partial<ParticleSoundSettings>> = {
  velvet: {
    dustVolume: 0.50,
    dustToneHz: 2200,
    crackleDensity: 150,
    crackleSharpness: 1.0,
    sparkleIntensity: 0.30,
    sparkleFreqHz: 9200,
    tailTime: 0.42,
    releaseTime: 0.42,
    volumeCurve: 1.3,
  },
  tactile: {
    dustVolume: 0.25,
    dustToneHz: 2800,
    crackleDensity: 230,
    crackleSharpness: 1.45,
    sparkleIntensity: 0.20,
    sparkleFreqHz: 10500,
    tailTime: 0.26,
    releaseTime: 0.26,
    volumeCurve: 1.45,
  },
  stardust: {
    dustVolume: 0.38,
    dustToneHz: 3200,
    crackleDensity: 190,
    crackleSharpness: 1.1,
    sparkleIntensity: 0.65,
    sparkleFreqHz: 11200,
    tailTime: 0.50,
    releaseTime: 0.50,
    volumeCurve: 1.25,
  },
  plasma: {
    dustVolume: 0.45,
    dustToneHz: 1800,
    crackleDensity: 260,
    crackleSharpness: 1.6,
    sparkleIntensity: 0.45,
    sparkleFreqHz: 12500,
    tailTime: 0.24,
    releaseTime: 0.24,
    volumeCurve: 1.5,
  },
};

export const SoundCurves = {
  power(x: number, exponent: number): number {
    const clamped = Math.max(0, Math.min(1, x));
    return Math.pow(clamped, Math.max(0.1, exponent));
  },

  logFrequency(factor: number, minFreq: number, maxFreq: number): number {
    const clamped = Math.max(0, Math.min(1, factor));
    const minLog = Math.log(Math.max(20, minFreq));
    const maxLog = Math.log(Math.max(minFreq + 1, maxFreq));
    return Math.exp(minLog + clamped * (maxLog - minLog));
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  },
};
