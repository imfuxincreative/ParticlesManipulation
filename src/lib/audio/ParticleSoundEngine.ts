"use client";

import {
  ParticleSoundPreset,
  ParticleSoundSettings,
  DEFAULT_SOUND_SETTINGS,
  SOUND_PRESETS,
  SoundTelemetry,
} from "./SoundParams";
import { ScatterAnalyzer, ScatterAnalysisResult } from "./ScatterAnalyzer";
import { TickEngine } from "./TickEngine";

export type { ParticleSoundPreset, ParticleSoundSettings, SoundTelemetry };

export interface ParticleAudioSettings extends ParticleSoundSettings {
  volume?: number;
  tactileTexture?: number;
  tactilePitch?: number;
  tactileResonance?: number;
  tactileSnap?: number;
  preset?: ParticleSoundPreset;
  pitch?: number;
  sensitivity?: number;
  onsetStrength?: number;
}

export interface ParticleSoundUpdateParams {
  motionEnergy?: number;
  activeRatio?: number;
  onset?: number;
  panX?: number;
  ambientDrive?: number;
  proximity?: number;
  posBuffer?: Float32Array;
  restBuffer?: Float32Array;
  particleCount?: number;
  pointerSpeed?: number;
  delta?: number;
}

/**
 * ParticleSoundEngine: Speed-reactive tactile particle sound engine.
 * Pure, crisp, tacky particle sound with ZERO background hiss.
 */
export class ParticleSoundEngine {
  private static instance: ParticleSoundEngine | null = null;

  private ctx: AudioContext | null = null;
  private isInitialized = false;

  private scatterAnalyzer: ScatterAnalyzer = new ScatterAnalyzer();
  private tickEngine: TickEngine = new TickEngine();

  // Master Output Chain: Submix -> Proximity -> Limiter -> Master Gain -> Output
  private masterSubmix: GainNode | null = null;
  private proximityGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  private settings: ParticleSoundSettings = { ...DEFAULT_SOUND_SETTINGS };

  private latestStats: ScatterAnalysisResult = {
    energy: 0,
    speedNorm: 0,
    densityNorm: 0,
    distanceNorm: 0,
    rawSpeed: 0,
    maxSpeed: 0,
    activeCount: 0,
    activeRatio: 0,
    avgDistance: 0,
    centroidX: 0,
    centroidY: 0,
    centroidZ: 0,
  };

  private constructor() {
    if (typeof window !== "undefined") {
      this.attachUnlockListeners();
      this.attachVisibilityListeners();
    }
  }

  public static getInstance(): ParticleSoundEngine {
    if (!ParticleSoundEngine.instance) {
      ParticleSoundEngine.instance = new ParticleSoundEngine();
    }
    return ParticleSoundEngine.instance;
  }

  private attachUnlockListeners(): void {
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true, once: true });
    window.addEventListener("click", unlock, { passive: true, once: true });
    window.addEventListener("keydown", unlock, { passive: true, once: true });
    window.addEventListener("touchend", unlock, { passive: true, once: true });
  }

  private attachVisibilityListeners(): void {
    if (typeof document === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) {
        if (this.ctx.state === "running") {
          this.ctx.suspend().catch(() => {});
        }
      } else {
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
      }
    });
  }

  public init(): void {
    if (this.isInitialized || typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass({ latencyHint: "interactive" });

      // 1. MASTER CHAIN
      this.masterSubmix = this.ctx.createGain();
      this.masterSubmix.gain.value = 1.0;

      this.proximityGain = this.ctx.createGain();
      this.proximityGain.gain.value = 1.0;
      this.masterSubmix.connect(this.proximityGain);

      // Limiter prevents clipping on violent multi-finger swipes
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3.0;
      this.limiter.knee.value = 6.0;
      this.limiter.ratio.value = 14.0;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;
      this.proximityGain.connect(this.limiter);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.settings.enabled ? this.settings.masterVolume : 0.0;
      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 2. INIT GRANULAR TICK ENGINE (PURE TACTILE TICKS, NO HISS)
      this.tickEngine.init(this.ctx, this.masterSubmix);
      this.tickEngine.syncSettings(this.settings);

      this.isInitialized = true;
    } catch (err) {
      console.warn("ParticleSoundEngine init skipped/failed:", err);
    }
  }

  /**
   * Real-time audio frame update. Called once per frame directly from useFrame.
   */
  public update(params: ParticleSoundUpdateParams): void {
    if (!this.settings.enabled) return;

    if (!this.isInitialized && typeof window !== "undefined") {
      this.init();
    }
    if (!this.ctx) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const {
      posBuffer,
      restBuffer,
      particleCount,
      pointerSpeed = 0,
      delta = 0.016,
      panX = 0,
      proximity = 1.0,
    } = params;

    // 1. RUN SCATTER-ENERGY ANALYSIS FROM REAL PARTICLE DATA
    if (posBuffer && restBuffer && particleCount && particleCount > 0) {
      this.latestStats = this.scatterAnalyzer.analyzeBuffers(
        posBuffer,
        restBuffer,
        particleCount,
        pointerSpeed,
        delta,
        {
          speedSensitivity: this.settings.speedSensitivity,
          distanceInfluence: this.settings.distanceInfluence,
          attackTime: this.settings.attackTime,
          releaseTime: this.settings.releaseTime,
        }
      );
    } else if (params.motionEnergy !== undefined) {
      this.latestStats.energy = params.motionEnergy;
      this.latestStats.speedNorm = Math.min(1.0, params.motionEnergy * this.settings.speedSensitivity);
      this.latestStats.densityNorm = params.activeRatio ?? params.motionEnergy;
      this.latestStats.distanceNorm = params.motionEnergy * 0.7;
    }

    // 2. UPDATE GRANULAR TICK ENGINE
    this.tickEngine.syncSettings(this.settings);
    this.tickEngine.updateFrameStats(this.latestStats, this.settings, panX);

    // 3. PROXIMITY DISTANCE FADE (Scroll away = fade to silence)
    if (this.proximityGain) {
      this.proximityGain.gain.setTargetAtTime(Math.max(0, Math.min(1, proximity)), now, 0.04);
    }
  }

  public applyPreset(preset: ParticleSoundPreset): void {
    const presetOverrides = SOUND_PRESETS[preset];
    if (presetOverrides) {
      this.updateSettings(presetOverrides);
    }
  }

  public updateSettings(newSettings: Partial<ParticleAudioSettings>): void {
    const mapped: Partial<ParticleSoundSettings> = { ...newSettings };

    if (newSettings.volume !== undefined && newSettings.masterVolume === undefined) {
      mapped.masterVolume = newSettings.volume;
    }
    if (newSettings.tactilePitch !== undefined && newSettings.basePitchHz === undefined) {
      mapped.basePitchHz = newSettings.tactilePitch;
    }
    if (newSettings.sensitivity !== undefined && newSettings.speedSensitivity === undefined) {
      mapped.speedSensitivity = newSettings.sensitivity;
    }
    if (newSettings.tailTime !== undefined) {
      mapped.releaseTime = newSettings.tailTime;
    } else if (newSettings.releaseTime !== undefined) {
      mapped.tailTime = newSettings.releaseTime;
    }

    this.settings = { ...this.settings, ...mapped };

    if (this.ctx && this.masterGain && mapped.masterVolume !== undefined) {
      const targetVol = this.settings.enabled ? this.settings.masterVolume : 0.0;
      this.masterGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.03);
    }

    this.tickEngine.syncSettings(this.settings);
  }

  public getSettings(): ParticleSoundSettings {
    return { ...this.settings };
  }

  public getTelemetry(): SoundTelemetry {
    const tickTelemetry = this.tickEngine.getTelemetry();
    return {
      energy: this.latestStats.energy,
      speedNorm: this.latestStats.speedNorm,
      densityNorm: this.latestStats.densityNorm,
      distanceNorm: this.latestStats.distanceNorm,
      grainRate: tickTelemetry.grainRate,
      currentPitchHz: tickTelemetry.currentPitchHz,
      activeVoices: tickTelemetry.activeVoices,
    };
  }

  public dispose(): void {
    this.tickEngine.dispose();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}

export const particleSoundEngine = ParticleSoundEngine.getInstance();
