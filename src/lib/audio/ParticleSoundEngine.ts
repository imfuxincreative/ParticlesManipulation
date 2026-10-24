"use client";

export type ParticleSoundPreset = "velvet" | "tactile" | "stardust" | "plasma";

export interface ParticleAudioSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0 (Master Volume)
  ambientVolume: number; // 0.0 to 0.15 (Always-on idle drift volume)
  preset: ParticleSoundPreset;
  pitch: number; // 0.5 to 2.0 (Pitch multiplier)
  shimmer: number; // 0.0 to 1.0 (Crystal chimes intensity)
  sensitivity: number; // 0.1 to 3.0 (Motion sensitivity)
  onsetStrength: number; // 0.0 to 1.5 ("Kh" attack burst strength)
  nearDistance: number; // World distance where audio is 100% volume
  farDistance: number; // World distance where audio fades to 0%

  // Tactile & Sound Taste Controls
  tactileTexture: number; // 0.0 = 100% Crisp Tactile Clicks, 1.0 = 100% Sandy Silk
  tactilePitch: number; // 400 Hz (deep thock) to 6000 Hz (crystal ping)
  tactileResonance: number; // 1.0 (dry tick) to 12.0 (resonant chime ping)
  tactileSnap: number; // 0.0 to 1.5 (transient punch of particle hits)
}

export interface ParticleSoundUpdateParams {
  motionEnergy: number; // 0.0 to 1.0 (aggregate normalized particle speed)
  activeRatio: number; // 0.0 to 1.0 (fraction of particles actively moving)
  onset: number; // >= 0.0 (instantaneous rise in motion energy)
  panX: number; // -1.0 to 1.0 (screen X centroid of moving particles)
  ambientDrive: number; // 0.0 to 1.0 (flowStrength * flowSpeed)
  proximity: number; // 0.0 to 1.0 (1.0 = near model, 0.0 = scrolled far away)
}

export class ParticleSoundEngine {
  private static instance: ParticleSoundEngine | null = null;

  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Layer 1: Ambient Drift (Always-on subtle velvet breath)
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientHighpass: BiquadFilterNode | null = null;
  private ambientLowpass: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private ambientLfoGain: GainNode | null = null;

  // Layer 2: Tactile Physical Clicks (Beads, glass, haptic ticks - NON-SANDY)
  private tactileSource: AudioBufferSourceNode | null = null;
  private tactileBandpass: BiquadFilterNode | null = null;
  private tactilePeaking: BiquadFilterNode | null = null;
  private tactileGain: GainNode | null = null;

  // Layer 3: Sandy Silk Air ("Khsssss" shimmer)
  private noiseSource: AudioBufferSourceNode | null = null;
  private airHighpass: BiquadFilterNode | null = null;
  private airPeaking: BiquadFilterNode | null = null;
  private airLowpass: BiquadFilterNode | null = null;
  private airGain: GainNode | null = null;

  // Layer 4: Crystal Chimes Resonators
  private crystalResonators: BiquadFilterNode[] = [];
  private crystalGain: GainNode | null = null;

  // Motion Submix Gain (combined tactile + sand + crystal, scaled by motionEnergy)
  private motionSubmixGain: GainNode | null = null;

  // Layer 5: Onset Transient ("Kh" scraping attack burst)
  private onsetSource: AudioBufferSourceNode | null = null;
  private onsetFilter: BiquadFilterNode | null = null;
  private onsetGain: GainNode | null = null;
  private lastOnsetTime = 0;

  // Master Stage: Proximity -> Limiter -> Panner -> Master -> Output
  private proximityGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private masterGain: GainNode | null = null;

  // Auto-sleep timer when scrolled far away
  private zeroProximityTimer = 0;

  // Settings with user's preferred defaults applied
  private settings: ParticleAudioSettings = {
    enabled: true,
    volume: 0.35, // 35% from user settings
    ambientVolume: 0.025, // 2.5% from user settings
    preset: "velvet", // Velvet from user settings
    pitch: 0.80, // 0.80x from user settings
    shimmer: 0.60, // 60% from user settings
    sensitivity: 0.5, // 0.5x from user settings
    onsetStrength: 0.0, // 0% from user settings
    nearDistance: 25.0,
    farDistance: 120.0, // 120u from user settings
    tactileTexture: 0.35, // 65% Tactile / 35% Sand from user settings
    tactilePitch: 400, // 400 Hz (Thock) from user settings
    tactileResonance: 10.0, // 10.0 Q from user settings
    tactileSnap: 1.4, // 1.40x from user settings
  };

  private constructor() {
    if (typeof window !== "undefined") {
      this.attachUnlockListeners();
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

  public init(): void {
    if (this.isInitialized || typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass({ latencyHint: "interactive" });
      const sampleRate = this.ctx.sampleRate;

      // ─── 1. SYNTHESIZE DISCRETE TACTILE CLICK / BEAD BUFFER ───
      // Stochastic micro-impact grains (glass beads, haptic switches, tactile particles)
      const bufferLen = sampleRate * 3;
      const clickBuffer = this.ctx.createBuffer(1, bufferLen, sampleRate);
      const clickData = clickBuffer.getChannelData(0);

      let cursor = 0;
      while (cursor < bufferLen - 200) {
        // Stochastic spacing between particle micro-impacts
        cursor += Math.floor(40 + Math.random() * 260);
        if (cursor >= bufferLen - 200) break;

        const grainLen = Math.floor(18 + Math.random() * 45); // 0.4ms to 1.0ms crisp transient
        const amp = Math.pow(Math.random(), 1.6) * (Math.random() > 0.5 ? 1 : -1);
        const pitchVar = 0.85 + Math.random() * 0.3; // Micro-variety across particle hits

        for (let k = 0; k < grainLen; k++) {
          const t = k / grainLen;
          const env = Math.exp(-t * 7.5) * (1.0 - t); // Very crisp attack with rapid decay
          const cycle = Math.sin(k * 0.55 * pitchVar);
          clickData[cursor + k] += amp * env * cycle * 0.8;
        }
      }

      this.tactileSource = this.ctx.createBufferSource();
      this.tactileSource.buffer = clickBuffer;
      this.tactileSource.loop = true;

      // Tactile filter: tuned by tactilePitch (deep thock <--> glass/crystal ping)
      this.tactileBandpass = this.ctx.createBiquadFilter();
      this.tactileBandpass.type = "bandpass";
      this.tactileBandpass.frequency.value = this.settings.tactilePitch;
      this.tactileBandpass.Q.value = this.settings.tactileResonance;

      this.tactilePeaking = this.ctx.createBiquadFilter();
      this.tactilePeaking.type = "peaking";
      this.tactilePeaking.frequency.value = this.settings.tactilePitch * 1.4;
      this.tactilePeaking.gain.value = 5.0;
      this.tactilePeaking.Q.value = 2.0;

      this.tactileGain = this.ctx.createGain();
      // Tactile volume inversely proportional to sandy texture
      this.tactileGain.gain.value = (1.0 - this.settings.tactileTexture) * this.settings.tactileSnap;

      this.tactileSource.connect(this.tactileBandpass);
      this.tactileBandpass.connect(this.tactilePeaking);
      this.tactilePeaking.connect(this.tactileGain);

      // ─── 2. SYNTHESIZE HIGH-AIR NOISE BUFFER (FOR SILK/SAND TEXTURE) ───
      const noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        const w1 = Math.random() * 2 - 1;
        const w2 = Math.random() * 2 - 1;
        noiseData[i] = (w1 - w2 * 0.7) * 0.75;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      // Air filters: Highpass strips out radio midrange (<5.8 kHz)
      this.airHighpass = this.ctx.createBiquadFilter();
      this.airHighpass.type = "highpass";
      this.airHighpass.frequency.value = 5800;
      this.airHighpass.Q.value = 0.8;

      this.airPeaking = this.ctx.createBiquadFilter();
      this.airPeaking.type = "peaking";
      this.airPeaking.frequency.value = 9500;
      this.airPeaking.gain.value = 6.0;
      this.airPeaking.Q.value = 1.4;

      this.airLowpass = this.ctx.createBiquadFilter();
      this.airLowpass.type = "lowpass";
      this.airLowpass.frequency.value = 16500;
      this.airLowpass.Q.value = 0.7;

      this.airGain = this.ctx.createGain();
      this.airGain.gain.value = this.settings.tactileTexture * 0.7;

      this.noiseSource.connect(this.airHighpass);
      this.airHighpass.connect(this.airPeaking);
      this.airPeaking.connect(this.airLowpass);
      this.airLowpass.connect(this.airGain);

      // ─── 3. CRYSTALLINE CHIMES RESONATORS ───
      const crystalFreqs = [2637, 3136, 3951, 5274];
      this.crystalGain = this.ctx.createGain();
      this.crystalGain.gain.value = this.settings.shimmer * 0.35;

      this.crystalResonators = crystalFreqs.map((freq) => {
        const bp = this.ctx!.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = freq;
        bp.Q.value = 18.0;
        this.noiseSource!.connect(bp);
        bp.connect(this.crystalGain!);
        return bp;
      });

      // ─── 4. MOTION SUBMIX GAIN (TACTILE + SAND + CRYSTAL) ───
      this.motionSubmixGain = this.ctx.createGain();
      this.motionSubmixGain.gain.value = 0.0;

      this.tactileGain.connect(this.motionSubmixGain);
      this.airGain.connect(this.motionSubmixGain);
      this.crystalGain.connect(this.motionSubmixGain);

      // ─── 5. ONSET TRANSIENT BURST ("KH" IMPACT ATTACK) ───
      this.onsetSource = this.ctx.createBufferSource();
      this.onsetSource.buffer = noiseBuffer;
      this.onsetSource.loop = true;

      this.onsetFilter = this.ctx.createBiquadFilter();
      this.onsetFilter.type = "bandpass";
      this.onsetFilter.frequency.value = 4200;
      this.onsetFilter.Q.value = 2.2;

      this.onsetGain = this.ctx.createGain();
      this.onsetGain.gain.value = 0.0;

      this.onsetSource.connect(this.onsetFilter);
      this.onsetFilter.connect(this.onsetGain);

      // ─── 6. AMBIENT DRIFT LAYER (ALWAYS-ON GENTLE BREATH) ───
      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = noiseBuffer;
      this.ambientSource.loop = true;

      this.ambientHighpass = this.ctx.createBiquadFilter();
      this.ambientHighpass.type = "highpass";
      this.ambientHighpass.frequency.value = 7200;

      this.ambientLowpass = this.ctx.createBiquadFilter();
      this.ambientLowpass.type = "lowpass";
      this.ambientLowpass.frequency.value = 11500;

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.settings.ambientVolume;

      // 0.15 Hz breathing modulation
      this.ambientLfo = this.ctx.createOscillator();
      this.ambientLfo.frequency.value = 0.15;
      this.ambientLfoGain = this.ctx.createGain();
      this.ambientLfoGain.gain.value = 0.008;
      this.ambientLfo.connect(this.ambientLfoGain);
      this.ambientLfoGain.connect(this.ambientGain.gain);
      this.ambientLfo.start();

      this.ambientSource.connect(this.ambientHighpass);
      this.ambientHighpass.connect(this.ambientLowpass);
      this.ambientLowpass.connect(this.ambientGain);

      // ─── 7. MASTER MIX: PROXIMITY -> LIMITER -> PANNER -> MASTER ───
      this.proximityGain = this.ctx.createGain();
      this.proximityGain.gain.value = 1.0;

      this.motionSubmixGain.connect(this.proximityGain);
      this.onsetGain.connect(this.proximityGain);
      this.ambientGain.connect(this.proximityGain);

      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6.0;
      this.limiter.knee.value = 6.0;
      this.limiter.ratio.value = 12.0;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.15;

      this.proximityGain.connect(this.limiter);

      if (this.ctx.createStereoPanner) {
        this.pannerNode = this.ctx.createStereoPanner();
        this.pannerNode.pan.value = 0.0;
        this.limiter.connect(this.pannerNode);
        this.masterGain = this.ctx.createGain();
        this.pannerNode.connect(this.masterGain);
      } else {
        this.masterGain = this.ctx.createGain();
        this.limiter.connect(this.masterGain);
      }

      this.masterGain.gain.value = this.settings.enabled ? this.settings.volume : 0.0;
      this.masterGain.connect(this.ctx.destination);

      // Start looping sources
      this.tactileSource.start();
      this.noiseSource.start();
      this.onsetSource.start();
      this.ambientSource.start();

      this.applyPreset(this.settings.preset);
      this.isInitialized = true;
    } catch (err) {
      console.warn("ParticleSoundEngine init skipped/failed:", err);
    }
  }

  /**
   * Real-time audio frame update. Called once per frame directly from useFrame.
   */
  public update(params: ParticleSoundUpdateParams): void {
    if (!this.settings.enabled || !this.ctx) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const { motionEnergy, onset, panX, ambientDrive, proximity } = params;

    // ─── A. PROXIMITY FADE ───
    if (this.proximityGain) {
      this.proximityGain.gain.setTargetAtTime(proximity, now, 0.04);
    }

    if (proximity <= 0.001) {
      this.zeroProximityTimer++;
      if (this.zeroProximityTimer > 120 && this.ctx.state === "running") {
        this.ctx.suspend().catch(() => {});
        return;
      }
    } else {
      this.zeroProximityTimer = 0;
    }

    // ─── B. AMBIENT DRIFT LAYER ───
    if (this.ambientGain) {
      const targetAmbient = this.settings.ambientVolume * Math.min(1.0, 0.4 + ambientDrive * 1.5);
      this.ambientGain.gain.setTargetAtTime(targetAmbient, now, 0.08);
    }

    // ─── C. ONSET TRANSIENT BURST ───
    if (this.onsetGain && this.settings.onsetStrength > 0.01 && onset > 0.035 && now - this.lastOnsetTime > 0.06) {
      this.lastOnsetTime = now;
      const onsetAmp = Math.min(1.0, onset * 2.8 * this.settings.onsetStrength);
      const attackTime = 0.004;
      const decayDuration = onset > 0.15 ? 0.20 : 0.10;

      this.onsetGain.gain.cancelScheduledValues(now);
      this.onsetGain.gain.setValueAtTime(this.onsetGain.gain.value, now);
      this.onsetGain.gain.linearRampToValueAtTime(onsetAmp, now + attackTime);
      this.onsetGain.gain.exponentialRampToValueAtTime(0.0001, now + attackTime + decayDuration);
    }

    // ─── D. MOTION SCATTER LAYER (TACTILE CLICKS + AIR) ───
    if (this.motionSubmixGain) {
      const scaledMotion = Math.min(1.0, motionEnergy * this.settings.sensitivity);
      const motionLevel = Math.pow(scaledMotion, 1.25);

      // Fast 5ms response
      this.motionSubmixGain.gain.setTargetAtTime(motionLevel * 0.95, now, 0.006);

      // Dynamic tactile filter pitch rise with movement speed
      if (this.tactileBandpass) {
        const basePitch = this.settings.tactilePitch * this.settings.pitch;
        const pitchBoost = scaledMotion * 500;
        this.tactileBandpass.frequency.setTargetAtTime(basePitch + pitchBoost, now, 0.03);
        if (this.tactilePeaking) {
          this.tactilePeaking.frequency.setTargetAtTime((basePitch + pitchBoost) * 1.4, now, 0.03);
        }
      }

      if (this.airHighpass && this.airPeaking) {
        const baseAir = 5800 * this.settings.pitch;
        const brightnessBoost = scaledMotion * 2800;
        this.airHighpass.frequency.setTargetAtTime(baseAir + brightnessBoost * 0.25, now, 0.02);
        this.airPeaking.frequency.setTargetAtTime(9500 * this.settings.pitch + brightnessBoost, now, 0.02);
      }
    }

    // ─── E. STEREO PANNING ───
    if (this.pannerNode) {
      const clamped = Math.max(-1.0, Math.min(1.0, panX));
      this.pannerNode.pan.setTargetAtTime(clamped, now, 0.04);
    }
  }

  /**
   * Apply sonic preset (Velvet vs. Tactile vs. Stardust vs. Plasma)
   */
  public applyPreset(preset: ParticleSoundPreset): void {
    this.settings.preset = preset;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (preset === "velvet") {
      // User's customized velvet preset: deep thock, resonant body, crisp snap, tactile/sand blend
      this.settings.tactileTexture = 0.35;
      this.settings.tactilePitch = 400;
      this.settings.tactileResonance = 10.0;
      this.settings.tactileSnap = 1.4;
      this.settings.pitch = 0.80;
      this.settings.shimmer = 0.60;
      this.settings.sensitivity = 0.5;
      this.settings.ambientVolume = 0.025;
      if (this.crystalGain) this.crystalGain.gain.setTargetAtTime(this.settings.shimmer * 0.45, now, 0.05);
    } else if (preset === "tactile") {
      // 100% Crisp Tactile Beads / Clicks (ZERO sand hiss!)
      this.settings.tactileTexture = 0.0;
      this.settings.tactilePitch = 2600;
      this.settings.tactileResonance = 5.0;
      this.settings.tactileSnap = 1.1;
      if (this.crystalGain) this.crystalGain.gain.setTargetAtTime(0.0, now, 0.05);
    } else if (preset === "stardust") {
      // Luminous celestial stardust with crystal chimes
      this.settings.tactileTexture = 0.40;
      this.settings.tactilePitch = 3200;
      this.settings.tactileResonance = 6.0;
      this.settings.tactileSnap = 0.75;
      if (this.crystalGain) this.crystalGain.gain.setTargetAtTime(this.settings.shimmer * 0.45, now, 0.05);
    } else if (preset === "plasma") {
      // Electric ionized plasma
      this.settings.tactileTexture = 0.50;
      this.settings.tactilePitch = 1400;
      this.settings.tactileResonance = 3.0;
      this.settings.tactileSnap = 0.9;
      if (this.crystalGain) this.crystalGain.gain.setTargetAtTime(this.settings.shimmer * 0.20, now, 0.05);
    }

    this.applyTactileGains(now);
  }

  private applyTactileGains(now: number): void {
    if (!this.ctx) return;
    const texture = this.settings.tactileTexture; // 0 = full tactile, 1 = full sand

    if (this.tactileGain) {
      const tGain = (1.0 - texture) * this.settings.tactileSnap;
      this.tactileGain.gain.setTargetAtTime(tGain, now, 0.03);
    }

    if (this.airGain) {
      const aGain = texture * 0.75;
      this.airGain.gain.setTargetAtTime(aGain, now, 0.03);
    }

    if (this.tactileBandpass) {
      this.tactileBandpass.frequency.setTargetAtTime(this.settings.tactilePitch * this.settings.pitch, now, 0.03);
      this.tactileBandpass.Q.setTargetAtTime(this.settings.tactileResonance, now, 0.03);
    }

    if (this.tactilePeaking) {
      this.tactilePeaking.frequency.setTargetAtTime(this.settings.tactilePitch * this.settings.pitch * 1.4, now, 0.03);
    }
  }

  /**
   * Update engine settings live from UI or simulation context.
   */
  public updateSettings(newSettings: Partial<ParticleAudioSettings>): void {
    const prevPreset = this.settings.preset;
    this.settings = { ...this.settings, ...newSettings };

    const now = this.ctx ? this.ctx.currentTime : 0;

    if (newSettings.preset && newSettings.preset !== prevPreset) {
      this.applyPreset(newSettings.preset);
    } else if (this.ctx) {
      this.applyTactileGains(now);
    }

    if (this.crystalGain && this.ctx && newSettings.shimmer !== undefined) {
      const chimeBase = (this.settings.preset === "velvet" || this.settings.preset === "tactile") ? 0.0 : 0.45;
      this.crystalGain.gain.setTargetAtTime(this.settings.shimmer * chimeBase, now, 0.05);
    }

    if (this.masterGain && this.ctx && newSettings.volume !== undefined) {
      const targetVol = this.settings.enabled ? this.settings.volume : 0.0;
      this.masterGain.gain.setTargetAtTime(targetVol, now, 0.03);
    }

    if (this.ambientGain && this.ctx && newSettings.ambientVolume !== undefined) {
      this.ambientGain.gain.setTargetAtTime(this.settings.ambientVolume, now, 0.05);
    }
  }

  public getSettings(): ParticleAudioSettings {
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

export const particleSoundEngine = ParticleSoundEngine.getInstance();
