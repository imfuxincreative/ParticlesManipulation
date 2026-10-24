"use client";

import { ParticleSoundSettings, SoundCurves } from "./SoundParams";
import { ScatterAnalysisResult } from "./ScatterAnalyzer";

/**
 * TickEngine: Digital Particle Texture Synthesizer.
 * Creates a soft, tactile, digital particle texture:
 * 1. Velvet Granular Dust (soft powder / cloud body)
 * 2. Tactile Micro-Crackles (delicate static electricity / dust grains)
 * 3. High-Air Sparkle (crystalline stardust sheen)
 */
export class TickEngine {
  private ctx: AudioContext | null = null;

  // Micro-crackle grain buffers (ultra-delicate 0.8–1.5ms static impulses)
  private crackleBuffers: AudioBuffer[] = [];

  // Looping pink velvet noise source for soft granular cloud body
  private dustSource: AudioBufferSourceNode | null = null;
  private dustFilter: BiquadFilterNode | null = null;
  private dustGain: GainNode | null = null;

  // High-air sparkle resonator
  private sparkleFilter: BiquadFilterNode | null = null;
  private sparkleGain: GainNode | null = null;

  // Master crackle submix and dynamic filter
  private crackleSubmix: GainNode | null = null;
  private crackleFilter: BiquadFilterNode | null = null;

  // Master Engine Stage
  private masterEngineGain: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;

  // Granular Scheduler State
  private isScheduling = false;
  private schedulerTimer: number | null = null;
  private nextGrainTime = 0;
  private activeVoices = 0;
  private readonly MAX_VOICES = 36;

  // Cached frame stats from ScatterAnalyzer
  private currentEnergy = 0.0;
  private currentSpeedNorm = 0.0;
  private currentDensityNorm = 0.0;
  private currentDistanceNorm = 0.0;
  private currentCentroidPan = 0.0;

  // Telemetry
  private scheduledCracklesLastSec = 0;
  private crackleCounter = 0;
  private lastRateCheckTime = 0;

  private currentSettings: ParticleSoundSettings | null = null;

  constructor() {}

  /**
   * Initialize with an active AudioContext and routing destination.
   */
  public init(ctx: AudioContext, destination: AudioNode): void {
    this.ctx = ctx;
    const sampleRate = ctx.sampleRate;

    // ─── 1. SYNTHESIZE PROCEDURAL MICRO-CRACKLE IMPULSES ───
    this.synthesizeCrackleBuffers(ctx);

    // ─── 2. MASTER ENGINE ROUTING ───
    this.masterEngineGain = ctx.createGain();
    this.masterEngineGain.gain.value = 1.0;

    if (ctx.createStereoPanner) {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.value = 0.0;
      this.masterEngineGain.connect(this.pannerNode);
      this.pannerNode.connect(destination);
    } else {
      this.masterEngineGain.connect(destination);
    }

    // ─── 3. LAYER 1: VELVET GRANULAR DUST (SOFT CLOUD BODY) ───
    // 2-second looping soft pink/brownian noise
    const dustBuf = ctx.createBuffer(1, sampleRate * 2, sampleRate);
    const dustData = dustBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < dustData.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      dustData[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }

    this.dustSource = ctx.createBufferSource();
    this.dustSource.buffer = dustBuf;
    this.dustSource.loop = true;

    // Bandpass sculpting: warm velvet body (1.2 kHz to 5.5 kHz)
    this.dustFilter = ctx.createBiquadFilter();
    this.dustFilter.type = "bandpass";
    this.dustFilter.frequency.value = 2600;
    this.dustFilter.Q.value = 1.2;

    this.dustGain = ctx.createGain();
    this.dustGain.gain.value = 0.0; // Modulated dynamically by motion

    this.dustSource.connect(this.dustFilter);
    this.dustFilter.connect(this.dustGain);
    this.dustGain.connect(this.masterEngineGain);
    this.dustSource.start();

    // ─── 4. LAYER 2: TACTILE MICRO-CRACKLES ───
    this.crackleFilter = ctx.createBiquadFilter();
    this.crackleFilter.type = "lowpass";
    this.crackleFilter.frequency.value = 8500;
    this.crackleFilter.Q.value = 1.4;

    this.crackleSubmix = ctx.createGain();
    this.crackleSubmix.gain.value = 1.0;

    this.crackleFilter.connect(this.crackleSubmix);
    this.crackleSubmix.connect(this.masterEngineGain);

    // ─── 5. LAYER 3: DELICATE HIGH-AIR SPARKLE ───
    // Resonant stardust sheen blooming on fast scatter
    this.sparkleFilter = ctx.createBiquadFilter();
    this.sparkleFilter.type = "bandpass";
    this.sparkleFilter.frequency.value = 9800;
    this.sparkleFilter.Q.value = 7.5;

    this.sparkleGain = ctx.createGain();
    this.sparkleGain.gain.value = 0.0; // Blooms with velocity

    // Dust feeds into sparkle resonator
    this.dustFilter.connect(this.sparkleFilter);
    this.sparkleFilter.connect(this.sparkleGain);
    this.sparkleGain.connect(this.masterEngineGain);

    // Start look-ahead crackle scheduler
    this.startScheduler();
  }

  /**
   * Synthesize microscopic, delicate static/dust impulses (0.8ms to 1.5ms).
   * Sounds like static electricity, vinyl dust, or delicate particle contact.
   */
  private synthesizeCrackleBuffers(ctx: AudioContext): void {
    const sampleRate = ctx.sampleRate;
    this.crackleBuffers = [];

    // Profile 0: Delicate Static Snap (1.0 ms)
    {
      const len = Math.floor(sampleRate * 0.0035);
      const buf = ctx.createBuffer(1, len, sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 2200) * (1.0 - t / 0.0035);
        const impulse = (Math.random() * 2 - 1) * 0.65;
        const resonance = Math.sin(2 * Math.PI * 3400 * t) * 0.35;
        d[i] = (impulse + resonance) * env * 0.85;
      }
      this.crackleBuffers.push(buf);
    }

    // Profile 1: Microscopic Pop / Grain Crackle (0.8 ms)
    {
      const len = Math.floor(sampleRate * 0.0028);
      const buf = ctx.createBuffer(1, len, sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 3100) * (1.0 - t / 0.0028);
        const cycle = Math.sin(2 * Math.PI * 4600 * t);
        d[i] = cycle * env * 0.8;
      }
      this.crackleBuffers.push(buf);
    }

    // Profile 2: Soft Dust Touch (1.2 ms)
    {
      const len = Math.floor(sampleRate * 0.004);
      const buf = ctx.createBuffer(1, len, sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 1800) * (1.0 - t / 0.004);
        const body = Math.sin(2 * Math.PI * 2200 * t) * 0.5;
        const air = (Math.random() * 2 - 1) * 0.5;
        d[i] = (body + air) * env * 0.75;
      }
      this.crackleBuffers.push(buf);
    }
  }

  /**
   * Update engine with frame statistics from ScatterAnalyzer.
   */
  public updateFrameStats(
    stats: ScatterAnalysisResult,
    settings: ParticleSoundSettings,
    panX: number
  ): void {
    if (!this.ctx) return;

    this.currentEnergy = stats.energy;
    this.currentSpeedNorm = stats.speedNorm;
    this.currentDensityNorm = stats.densityNorm;
    this.currentDistanceNorm = stats.distanceNorm;
    this.currentCentroidPan = Math.max(-1.0, Math.min(1.0, panX));

    const now = this.ctx.currentTime;
    const volCurve = settings.volumeCurve ?? 1.35;
    const speedVol = SoundCurves.power(this.currentSpeedNorm, volCurve);
    const motionDrive = Math.min(1.0, speedVol * 0.7 + this.currentEnergy * 0.3);

    // ─── 1. MODULATE VELVET GRANULAR DUST ───
    if (this.dustGain) {
      // Complete silence when idle; soft velvet cloud rises with motion
      const targetDust = settings.enabled
        ? (settings.dustVolume ?? 0.42) * motionDrive * 0.55
        : 0.0;
      this.dustGain.gain.setTargetAtTime(targetDust, now, 0.02);
    }

    if (this.dustFilter) {
      const baseTone = settings.dustToneHz ?? 2600;
      const targetFreq = baseTone + this.currentSpeedNorm * 1800;
      this.dustFilter.frequency.setTargetAtTime(targetFreq, now, 0.03);
    }

    // ─── 2. MODULATE DELICATE HIGH-AIR SPARKLE ───
    if (this.sparkleGain) {
      // Blooms delicately during fast scatter / wide particle spread
      const sparkleDrive = Math.pow(this.currentSpeedNorm * 0.65 + this.currentDistanceNorm * 0.35, 1.5);
      const targetSparkle = settings.enabled
        ? (settings.sparkleIntensity ?? 0.35) * sparkleDrive * 0.30
        : 0.0;
      this.sparkleGain.gain.setTargetAtTime(targetSparkle, now, 0.03);
    }

    if (this.sparkleFilter) {
      const baseSparkleFreq = settings.sparkleFreqHz ?? 9800;
      this.sparkleFilter.frequency.setTargetAtTime(baseSparkleFreq, now, 0.04);
    }

    // ─── 3. MODULATE CRACKLE SUBMIX ───
    if (this.crackleFilter) {
      // Subtle brightness opening with velocity
      const cutoff = 5500 + this.currentSpeedNorm * 6500;
      this.crackleFilter.frequency.setTargetAtTime(cutoff, now, 0.025);
    }

    // ─── 4. MASTER STEREO PAN ───
    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(this.currentCentroidPan, now, 0.04);
    }
  }

  public syncSettings(settings: ParticleSoundSettings): void {
    this.currentSettings = settings;
  }

  /**
   * Lookahead Granular Crackle Scheduler.
   */
  private startScheduler(): void {
    if (this.isScheduling) return;
    this.isScheduling = true;
    this.nextGrainTime = this.ctx ? this.ctx.currentTime : 0;

    const tick = () => {
      this.processScheduler();
      if (this.isScheduling) {
        this.schedulerTimer = window.setTimeout(tick, 20);
      }
    };

    tick();
  }

  private processScheduler(): void {
    if (!this.ctx || this.ctx.state !== "running") return;

    const now = this.ctx.currentTime;
    const scheduleAheadTime = 0.045;

    // Rate telemetry tracking
    if (now - this.lastRateCheckTime >= 1.0) {
      this.scheduledCracklesLastSec = this.crackleCounter;
      this.crackleCounter = 0;
      this.lastRateCheckTime = now;
    }

    // Completely silent when idle (zero CPU, zero hiss)
    if (this.currentEnergy < 0.001) {
      this.nextGrainTime = Math.max(this.nextGrainTime, now + 0.01);
      return;
    }

    if (this.nextGrainTime < now) {
      this.nextGrainTime = now;
    }

    while (this.nextGrainTime < now + scheduleAheadTime) {
      const settings = this.currentSettings;
      const densityCombined = Math.min(
        1.0,
        this.currentDensityNorm * 0.65 +
        this.currentEnergy * 0.35 +
        this.currentDistanceNorm * (settings?.distanceInfluence ?? 0.40) * 0.3
      );

      const maxRate = settings?.crackleDensity ?? 180;
      // Gentle, sparse crackles when slow -> dense delicate fizzing flurry when fast
      const effectiveRate = Math.max(2.0, maxRate * Math.pow(densityCombined, 1.25));

      if (this.activeVoices < this.MAX_VOICES) {
        this.scheduleSingleCrackle(this.nextGrainTime, settings);
        this.crackleCounter++;
      }

      // Poisson-like stochastic timing jitter (±35%) for natural organic micro-crackles
      const randomOffset = 1.0 + (Math.random() - 0.5) * 0.7;
      const interval = Math.max(0.002, (1.0 / effectiveRate) * randomOffset);

      this.nextGrainTime += interval;
    }
  }

  /**
   * Schedule one delicate micro-crackle grain at scheduledTime.
   */
  private scheduleSingleCrackle(scheduledTime: number, settings: ParticleSoundSettings | null): void {
    if (!this.ctx || !this.crackleFilter || this.crackleBuffers.length === 0) return;

    const volCurve = settings?.volumeCurve ?? 1.35;
    const sharpness = settings?.crackleSharpness ?? 1.15;

    // Select random micro-crackle profile
    const bufIdx = Math.floor(Math.random() * this.crackleBuffers.length);
    const buffer = this.crackleBuffers[bufIdx];

    // Subtle pitch jitter (±12%) so crackles blend like thousands of tiny stardust grains
    const pitchJitter = 0.90 + Math.random() * 0.25;
    const playbackRate = (0.95 + this.currentSpeedNorm * 0.45) * pitchJitter;

    // Volume follows speed dynamics
    const speedVol = SoundCurves.power(this.currentSpeedNorm, volCurve);
    const ampJitter = 0.75 + Math.random() * 0.45;
    const crackleVolume = Math.min(
      0.95,
      Math.max(0.015, speedVol * (0.35 + this.currentEnergy * 0.65) * ampJitter * 0.7)
    );

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(playbackRate, scheduledTime);

    const envGain = this.ctx.createGain();
    const duration = Math.max(0.001, (buffer.duration / playbackRate) / sharpness);

    envGain.gain.setValueAtTime(crackleVolume, scheduledTime);
    envGain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + duration);

    src.connect(envGain);
    envGain.connect(this.crackleFilter);

    this.activeVoices++;
    src.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      src.disconnect();
      envGain.disconnect();
    };

    src.start(scheduledTime);
    src.stop(scheduledTime + duration + 0.001);
  }

  public getTelemetry(): { grainRate: number; currentPitchHz: number; activeVoices: number } {
    return {
      grainRate: this.scheduledCracklesLastSec,
      currentPitchHz: Math.round(2600 + this.currentSpeedNorm * 1800),
      activeVoices: this.activeVoices,
    };
  }

  public dispose(): void {
    this.isScheduling = false;
    if (this.schedulerTimer !== null) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.dustSource) {
      try { this.dustSource.stop(); } catch (_) {}
      this.dustSource.disconnect();
    }
    if (this.masterEngineGain) {
      this.masterEngineGain.disconnect();
    }
  }
}
