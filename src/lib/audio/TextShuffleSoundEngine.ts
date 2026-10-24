"use client";

export type TextShuffleSoundType = "appear" | "disappear" | "hover";

export interface TextShuffleTickParams {
  type: TextShuffleSoundType;
  progress?: number; // 0.0 to 1.0 (relative progress of scramble animation)
  volume?: number;   // 0.0 to 1.0 multiplier
}

export class TextShuffleSoundEngine {
  private static instance: TextShuffleSoundEngine | null = null;

  private ctx: AudioContext | null = null;
  private isInitialized = false;
  private enabled = true;
  private masterVolume = 1.0; // Default full UI volume

  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private clickBuffer: AudioBuffer | null = null;

  private lastTickTime = 0;
  private activeVoices = 0;
  private readonly MAX_VOICES = 8;
  private readonly MIN_TICK_INTERVAL_SEC = 0.015; // Max ~65 ticks/sec for snappy audio response

  private constructor() {
    if (typeof window !== "undefined") {
      this.attachUnlockListeners();
    }
  }

  public static getInstance(): TextShuffleSoundEngine {
    if (!TextShuffleSoundEngine.instance) {
      TextShuffleSoundEngine.instance = new TextShuffleSoundEngine();
    }
    return TextShuffleSoundEngine.instance;
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

      // Dynamics limiter with transparent threshold to prevent volume attenuation
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -1.5;
      this.limiter.knee.value = 6.0;
      this.limiter.ratio.value = 4.0;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.06;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? this.masterVolume : 0.0;

      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Pre-synthesize high-frequency mechanical contact click buffer (1.8ms)
      const sampleRate = this.ctx.sampleRate;
      const clickFrames = Math.floor(sampleRate * 0.0025);
      this.clickBuffer = this.ctx.createBuffer(1, clickFrames, sampleRate);
      const clickData = this.clickBuffer.getChannelData(0);
      for (let i = 0; i < clickFrames; i++) {
        const t = i / clickFrames;
        const decay = Math.exp(-t * 9.0) * (1 - t);
        const noise = (Math.random() * 2 - 1) * 0.7;
        const sine = Math.sin(i * 0.8) * 0.3;
        clickData[i] = (noise + sine) * decay;
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn("TextShuffleSoundEngine init failed/skipped:", err);
    }
  }

  /**
   * Play a procedural micro-shuffle sound synced to a character tick.
   */
  public playTick(params: TextShuffleTickParams): void {
    if (!this.enabled || this.masterVolume <= 0.001) return;
    if (!this.ctx) {
      this.init();
      if (!this.ctx) return;
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    if (now - this.lastTickTime < this.MIN_TICK_INTERVAL_SEC) return;
    if (this.activeVoices >= this.MAX_VOICES) return;

    this.lastTickTime = now;
    this.activeVoices++;

    const { type, progress = 0.5, volume = 1.0 } = params;
    const finalGain = Math.max(0, Math.min(1.0, volume));

    // ─── 1. Mechanical Contact Haptic Tick ───
    if (this.clickBuffer && this.limiter) {
      const clickSrc = this.ctx.createBufferSource();
      clickSrc.buffer = this.clickBuffer;

      const clickFilter = this.ctx.createBiquadFilter();
      clickFilter.type = "highpass";
      clickFilter.frequency.value = 3200 + Math.random() * 800;

      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(0.75 * finalGain, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);

      clickSrc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.limiter);

      clickSrc.start(now);
      clickSrc.stop(now + 0.006);
    }

    // ─── 2. Digital Micro-Chirp (High-Tech Data Decipher Flutter) ───
    let baseFreq = 2400;
    if (type === "appear") {
      // Ascending data decipher chatter
      baseFreq = 2200 + progress * 700 + (Math.random() - 0.5) * 350;
    } else if (type === "disappear") {
      // Descending disintegration blips
      baseFreq = 2900 - progress * 900 + (Math.random() - 0.5) * 350;
    } else {
      // Hover: playful cybernetic frequency scatter
      baseFreq = 2400 + (Math.random() - 0.5) * 1100;
    }

    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.010);

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = baseFreq;
    bp.Q.value = 2.2;

    const env = this.ctx.createGain();
    const peakAmp = 0.55 * finalGain;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakAmp, now + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    osc.connect(bp);
    bp.connect(env);
    if (this.limiter) {
      env.connect(this.limiter);
    }

    osc.start(now);
    osc.stop(now + 0.014);

    osc.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      osc.disconnect();
      bp.disconnect();
      env.disconnect();
    };
  }

  /**
   * Play a clean, subtle settling confirmation ping when the word locks in.
   */
  public playResolve(volume = 1.0): void {
    if (!this.enabled || this.masterVolume <= 0.001) return;
    if (!this.ctx || !this.limiter) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const finalGain = Math.max(0, Math.min(1.0, volume));

    // Dual-harmonic high-tech lock ping (1760Hz & 2640Hz, harmonic fifth)
    const freqs = [1760, 2640];
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.limiter) return;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const gain = this.ctx.createGain();
      const amp = (idx === 0 ? 0.45 : 0.28) * finalGain;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.limiter);

      osc.start(now);
      osc.stop(now + 0.048);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.masterGain && this.ctx) {
      const target = this.enabled ? this.masterVolume : 0.0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1.0, vol));
    if (this.masterGain && this.ctx) {
      const target = this.enabled ? this.masterVolume : 0.0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  public getSettings() {
    return {
      enabled: this.enabled,
      volume: this.masterVolume,
    };
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}

export const textShuffleSoundEngine = TextShuffleSoundEngine.getInstance();
