"use client";

export interface InTouchIsolationParams {
  transitionProgress: number; // 0.0 (main scene) to 1.0 (peak blur & mist)
  isInTouch: boolean;
  isTransitioning: boolean;
  phase?: "idle" | "in" | "out";
  inTouchState?: "idle" | "entering" | "active" | "exiting";
}

export interface InTouchLightGlitchParams {
  flicker: number; // instantaneous multiplier (0.02 to ~3.5)
  isGlitching: boolean;
  eventType: string | null;
  delta: number;
}

export interface InTouchAudioSettings {
  enabled: boolean;
  isolationVolume: number; // default: 0.40
  glitchVolume: number;    // default: 0.45
}

export class InTouchAudioEngine {
  private static instance: InTouchAudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private isInitialized = false;

  private settings: InTouchAudioSettings = {
    enabled: true,
    isolationVolume: 0.85, // Prominent, rich cinematic isolation blur
    glitchVolume: 0.15,    // Low, subtle neon glitch volume
  };

  // ─── MASTER STAGE ───
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  // ─── 1. ISOLATION BLUR LAYER ───
  private subOsc1: OscillatorNode | null = null;
  private subOsc2: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  private muffleFilter1: BiquadFilterNode | null = null;
  private muffleFilter2: BiquadFilterNode | null = null;
  private pressureNoise: AudioBufferSourceNode | null = null;
  private pressureFilter: BiquadFilterNode | null = null;
  private pressureGain: GainNode | null = null;
  private isolationMasterGain: GainNode | null = null;

  // ─── 2. LIGHT GLITCH LAYER ───
  private neonBuzzOsc: OscillatorNode | null = null;
  private neonBuzzFilter: BiquadFilterNode | null = null;
  private neonBuzzGain: GainNode | null = null;
  private sparkBuffer: AudioBuffer | null = null;
  private sagOsc: OscillatorNode | null = null;
  private sagGain: GainNode | null = null;
  private glitchMasterGain: GainNode | null = null;

  private lastFlicker = 1.0;
  private lastSparkTime = 0;
  private wasGlitching = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.attachUnlockListeners();
    }
  }

  public static getInstance(): InTouchAudioEngine {
    if (!InTouchAudioEngine.instance) {
      InTouchAudioEngine.instance = new InTouchAudioEngine();
    }
    return InTouchAudioEngine.instance;
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

  public init(): void {
    if (this.isInitialized || typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass({ latencyHint: "interactive" });
      const sampleRate = this.ctx.sampleRate;

      // ── Master Dynamics Limiter & Master Gain ──
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6.0;
      this.limiter.knee.value = 6.0;
      this.limiter.ratio.value = 10.0;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.settings.enabled ? 1.0 : 0.0;

      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // ═══════════════════════════════════════════════════════
      // 1. ISOLATION BLUR LAYER SYNTHESIS (Warm, Audible, Cinematic)
      // ═══════════════════════════════════════════════════════
      this.isolationMasterGain = this.ctx.createGain();
      this.isolationMasterGain.gain.value = 0.0;

      // Cascaded 24dB/oct low-pass muffle filters
      this.muffleFilter1 = this.ctx.createBiquadFilter();
      this.muffleFilter1.type = "lowpass";
      this.muffleFilter1.frequency.value = 14000;
      this.muffleFilter1.Q.value = 3.2;

      this.muffleFilter2 = this.ctx.createBiquadFilter();
      this.muffleFilter2.type = "lowpass";
      this.muffleFilter2.frequency.value = 14000;
      this.muffleFilter2.Q.value = 2.0;

      this.muffleFilter1.connect(this.muffleFilter2);
      this.muffleFilter2.connect(this.isolationMasterGain);
      this.isolationMasterGain.connect(this.limiter);

      // Warm Cinematic Drone: 68Hz fundamental + 136.5Hz octave harmonic
      this.subGain = this.ctx.createGain();
      this.subGain.gain.value = 0.85;

      this.subOsc1 = this.ctx.createOscillator();
      this.subOsc1.type = "sine";
      this.subOsc1.frequency.value = 68.0;

      this.subOsc2 = this.ctx.createOscillator();
      this.subOsc2.type = "triangle";
      this.subOsc2.frequency.value = 136.5;

      // Soft saturation waveshaper for rich harmonic warmth
      const shaper = this.ctx.createWaveShaper();
      const nSamples = 1024;
      const curve = new Float32Array(nSamples);
      for (let i = 0; i < nSamples; i++) {
        const x = (i * 2) / nSamples - 1;
        curve[i] = Math.tanh(x * 1.5);
      }
      shaper.curve = curve;

      this.subOsc1.connect(shaper);
      this.subOsc2.connect(shaper);
      shaper.connect(this.subGain);
      this.subGain.connect(this.muffleFilter1);

      this.subOsc1.start();
      this.subOsc2.start();

      // Atmospheric Pressure Drop Whoosh (Brown noise burst)
      const noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < noiseData.length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        noiseData[i] = lastOut * 3.5;
      }

      this.pressureNoise = this.ctx.createBufferSource();
      this.pressureNoise.buffer = noiseBuffer;
      this.pressureNoise.loop = true;

      this.pressureFilter = this.ctx.createBiquadFilter();
      this.pressureFilter.type = "bandpass";
      this.pressureFilter.frequency.value = 240;
      this.pressureFilter.Q.value = 1.6;

      this.pressureGain = this.ctx.createGain();
      this.pressureGain.gain.value = 0.0;

      this.pressureNoise.connect(this.pressureFilter);
      this.pressureFilter.connect(this.pressureGain);
      this.pressureGain.connect(this.muffleFilter1);
      this.pressureNoise.start();

      // ═══════════════════════════════════════════════════════
      // 2. LIGHT GLITCH LAYER SYNTHESIS (Low, Subtle Neon Arc)
      // ═══════════════════════════════════════════════════════
      this.glitchMasterGain = this.ctx.createGain();
      this.glitchMasterGain.gain.value = this.settings.glitchVolume;
      this.glitchMasterGain.connect(this.limiter);

      // Neon Ballast 120Hz AC Arc Buzz
      this.neonBuzzOsc = this.ctx.createOscillator();
      this.neonBuzzOsc.type = "sawtooth";
      this.neonBuzzOsc.frequency.value = 120.0;

      this.neonBuzzFilter = this.ctx.createBiquadFilter();
      this.neonBuzzFilter.type = "bandpass";
      this.neonBuzzFilter.frequency.value = 1350;
      this.neonBuzzFilter.Q.value = 3.5;

      this.neonBuzzGain = this.ctx.createGain();
      this.neonBuzzGain.gain.value = 0.0;

      // Diode clipping distortion for authentic neon sizzle
      const buzzShaper = this.ctx.createWaveShaper();
      const bCurve = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const x = (i * 2) / 512 - 1;
        bCurve[i] = x > 0 ? Math.min(1.0, x * 2.5) : Math.max(-0.2, x * 0.5);
      }
      buzzShaper.curve = bCurve;

      this.neonBuzzOsc.connect(buzzShaper);
      buzzShaper.connect(this.neonBuzzFilter);
      this.neonBuzzFilter.connect(this.neonBuzzGain);
      this.neonBuzzGain.connect(this.glitchMasterGain);
      this.neonBuzzOsc.start();

      // Pre-synthesize high-voltage spark transient buffer
      const sparkLen = Math.floor(sampleRate * 0.008);
      this.sparkBuffer = this.ctx.createBuffer(1, sparkLen, sampleRate);
      const sparkData = this.sparkBuffer.getChannelData(0);
      for (let i = 0; i < sparkLen; i++) {
        const t = i / sparkLen;
        const decay = Math.exp(-t * 14.0) * (1 - t);
        sparkData[i] = (Math.random() * 2 - 1) * decay;
      }

      // Brownout Transformer Sag Oscillator
      this.sagOsc = this.ctx.createOscillator();
      this.sagOsc.type = "sine";
      this.sagOsc.frequency.value = 75.0;

      this.sagGain = this.ctx.createGain();
      this.sagGain.gain.value = 0.0;

      this.sagOsc.connect(this.sagGain);
      this.sagGain.connect(this.glitchMasterGain);
      this.sagOsc.start();

      this.isInitialized = true;
    } catch (err) {
      console.warn("InTouchAudioEngine init failed/skipped:", err);
    }
  }

  /**
   * Real-time update for Isolation Blur audio (sub-bass drone & muffle sweep).
   * - Transition ONLY: strictly active while transitioning (blur-in & blur-out).
   *   Swells as blur ramps in (0 -> 1) and fades out to silence as blur clears (1 -> 0).
   * - After transition (both InTouch scene resting & Main scene idle): COMPLETELY SILENT (0.0 gain).
   */
  public updateIsolation(params: InTouchIsolationParams): void {
    if (!this.settings.enabled || !this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const { transitionProgress, isTransitioning } = params;

    let targetCutoff = 8000;
    let targetIsoGain = 0.0;

    // ── ONLY active during the transition (blur in & blur out) ──
    if (isTransitioning && transitionProgress > 0.001) {
      const p = Math.max(0, Math.min(1, transitionProgress));
      // Hermite smoothstep for natural acoustic swell matching visual blur curve
      const smoothP = p * p * (3 - 2 * p);

      // Gain swells from 0.0 up to 100% isolationVolume at peak blur, and fades back to 0.0
      targetIsoGain = this.settings.isolationVolume * smoothP;
      // Resonant filter sweeps down from 8000Hz down to 280Hz at peak blur
      targetCutoff = 8000 + (280 - 8000) * Math.pow(p, 1.2);
    } else {
      // AFTER transition completes (fully entered into inTouch OR back in main scene):
      // Isolation sound is completely SILENT (0.0 gain)
      targetIsoGain = 0.0;
      targetCutoff = 8000;
    }

    // Apply cutoff filter sweeps
    if (this.muffleFilter1 && this.muffleFilter2) {
      this.muffleFilter1.frequency.setTargetAtTime(targetCutoff, now, 0.03);
      this.muffleFilter2.frequency.setTargetAtTime(targetCutoff * 1.4, now, 0.03);
    }

    // Apply master isolation gain with smooth ramp
    if (this.isolationMasterGain) {
      if (targetIsoGain <= 0.001) {
        this.isolationMasterGain.gain.setTargetAtTime(0.0, now, 0.02);
      } else {
        this.isolationMasterGain.gain.setTargetAtTime(targetIsoGain, now, 0.04);
      }
    }

    // ── Pressure Drop / Vacuum Whoosh (Only at transition blur peak) ──
    if (this.pressureGain && this.pressureFilter) {
      if (isTransitioning && transitionProgress > 0.12) {
        const p = Math.max(0, Math.min(1, transitionProgress));
        const whooshVol = Math.sin(p * Math.PI) * this.settings.isolationVolume * 0.85;
        this.pressureGain.gain.setTargetAtTime(whooshVol, now, 0.03);
        const whooshPitch = 160 + p * 220;
        this.pressureFilter.frequency.setTargetAtTime(whooshPitch, now, 0.03);
      } else {
        this.pressureGain.gain.setTargetAtTime(0.0, now, 0.03);
      }
    }
  }

  /**
   * Real-time update for Light Glitch audio (arc buzz, spark transients, brownout sag).
   */
  public updateLightGlitch(params: InTouchLightGlitchParams): void {
    if (!this.settings.enabled || !this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const { flicker, isGlitching, eventType } = params;

    // Detect voltage anomaly: only trigger during actual glitch events with noticeable flicker
    const dev = Math.abs(1.0 - flicker);
    const hasAnomaly = isGlitching && dev > 0.12;

    // ── 1. Neon Arc Buzz (Sizzle & Hum - Low, subtle background) ──
    if (this.neonBuzzGain && this.neonBuzzFilter) {
      if (hasAnomaly) {
        // Subtle, quiet electrical sizzle
        const buzzLevel = Math.min(0.20, dev * 0.35) * this.settings.glitchVolume;
        this.neonBuzzGain.gain.setTargetAtTime(buzzLevel, now, 0.008);

        const arcFreq = flicker > 1.0 ? 1600 + (flicker - 1.0) * 500 : 1100 + flicker * 400;
        this.neonBuzzFilter.frequency.setTargetAtTime(arcFreq, now, 0.01);
      } else {
        this.neonBuzzGain.gain.setTargetAtTime(0.0, now, 0.02);
      }
    }

    // ── 2. Sudden Step Spark Impulse (Soft, delicate snap) ──
    const dFlicker = Math.abs(flicker - this.lastFlicker);
    if (this.sparkBuffer && this.limiter && isGlitching && dFlicker > 0.45) {
      if (now - this.lastSparkTime > 0.04) {
        this.lastSparkTime = now;
        this.triggerSpark(now, Math.min(1.0, dFlicker * 0.8));
      }
    }

    // ── 3. Brownout Transformer Sag (Low & gentle) ──
    if (this.sagGain && this.sagOsc) {
      if (eventType === "deep_brownout" && flicker < 0.35) {
        const droopFreq = Math.max(45.0, 75.0 * flicker);
        this.sagOsc.frequency.setTargetAtTime(droopFreq, now, 0.02);
        this.sagGain.gain.setTargetAtTime(0.12 * this.settings.glitchVolume, now, 0.02);
      } else {
        this.sagGain.gain.setTargetAtTime(0.0, now, 0.04);
      }
    }

    this.lastFlicker = flicker;
    this.wasGlitching = isGlitching;
  }

  private triggerSpark(now: number, intensity: number): void {
    if (!this.ctx || !this.sparkBuffer || !this.limiter) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.sparkBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 4500 + Math.random() * 2000;

    const gain = this.ctx.createGain();
    // Very gentle spark volume
    const amp = 0.09 * intensity * this.settings.glitchVolume;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.limiter);

    src.start(now);
    src.stop(now + 0.007);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  public updateSettings(newSettings: Partial<InTouchAudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (this.masterGain && this.ctx) {
      const target = this.settings.enabled ? 1.0 : 0.0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
    if (this.glitchMasterGain && this.ctx && newSettings.glitchVolume !== undefined) {
      this.glitchMasterGain.gain.setTargetAtTime(this.settings.glitchVolume, this.ctx.currentTime, 0.03);
    }
  }

  public getSettings(): InTouchAudioSettings {
    return { ...this.settings };
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}

export const inTouchAudioEngine = InTouchAudioEngine.getInstance();
