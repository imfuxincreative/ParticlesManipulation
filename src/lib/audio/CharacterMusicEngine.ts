"use client";

export interface CharacterMusicSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0 (Master volume, default: 0.70)
  nearDistance: number; // World units where volume is 100% (default: 45)
  farDistance: number; // World units where volume fades to 0% (default: 160)
}

export class CharacterMusicEngine {
  private static instance: CharacterMusicEngine | null = null;

  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private targetVolume = 0.0;
  private currentProximity = 0.0;
  private rafId: number | null = null;

  private settings: CharacterMusicSettings = {
    enabled: true,
    volume: 0.70,
    nearDistance: 45.0,
    farDistance: 160.0,
  };

  private constructor() {
    if (typeof window !== "undefined") {
      this.initAudioElement();
      this.attachUnlockListeners();
      this.startVolumeLoop();
    }
  }

  public static getInstance(): CharacterMusicEngine {
    if (!CharacterMusicEngine.instance) {
      CharacterMusicEngine.instance = new CharacterMusicEngine();
    }
    return CharacterMusicEngine.instance;
  }

  private initAudioElement(): void {
    if (typeof window === "undefined" || this.audio) return;

    try {
      this.audio = document.createElement("audio");
      this.audio.src = "/character.mp3";
      this.audio.loop = true;
      this.audio.preload = "auto";
      this.audio.volume = 0.0;
      this.audio.style.display = "none";
      this.audio.setAttribute("aria-hidden", "true");
      document.body.appendChild(this.audio);
    } catch (err) {
      console.warn("[CharacterMusicEngine] Failed to create Audio element:", err);
      try {
        this.audio = new Audio("/character.mp3");
        this.audio.loop = true;
        this.audio.preload = "auto";
        this.audio.volume = 0.0;
      } catch {
        this.audio = null;
      }
    }
  }

  private attachUnlockListeners(): void {
    const tryUnlockAndPlay = () => {
      if (this.audio && this.targetVolume > 0.005 && this.audio.paused) {
        const p = this.audio.play();
        if (p !== undefined) {
          p.then(() => {
            this.isPlaying = true;
          }).catch(() => {});
        }
      }
    };

    window.addEventListener("pointerdown", tryUnlockAndPlay, { passive: true });
    window.addEventListener("pointerup", tryUnlockAndPlay, { passive: true });
    window.addEventListener("click", tryUnlockAndPlay, { passive: true });
    window.addEventListener("keydown", tryUnlockAndPlay, { passive: true });
    window.addEventListener("touchstart", tryUnlockAndPlay, { passive: true });
    window.addEventListener("touchend", tryUnlockAndPlay, { passive: true });
    window.addEventListener("wheel", tryUnlockAndPlay, { passive: true });
    window.addEventListener("scroll", tryUnlockAndPlay, { passive: true });
  }

  private startVolumeLoop(): void {
    if (this.rafId !== null) return;

    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      if (!this.audio) return;

      const current = this.audio.volume;
      const diff = this.targetVolume - current;

      if (Math.abs(diff) > 0.002) {
        // Smooth exponential interpolation (approaches target in ~300-400ms)
        const next = current + diff * 0.08;
        this.audio.volume = Math.max(0, Math.min(1, next));
      } else {
        this.audio.volume = Math.max(0, Math.min(1, this.targetVolume));
      }

      // Handle playback state based on target volume
      if (this.targetVolume > 0.005) {
        if (this.audio.paused) {
          const p = this.audio.play();
          if (p !== undefined) {
            p.then(() => {
              this.isPlaying = true;
            }).catch(() => {
              // Wait for user gesture
            });
          }
        }
      } else if (this.audio.volume <= 0.005 && !this.audio.paused) {
        this.audio.pause();
        this.isPlaying = false;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Real-time spatial proximity update from 3D camera / frame position to Simon character.
   * @param proximity Normalized proximity: 0.0 (far away / silence) to 1.0 (at character / full volume)
   */
  public updateProximity(proximity: number): void {
    const clamped = Math.max(0, Math.min(1, proximity));
    this.currentProximity = clamped;

    this.targetVolume = this.settings.enabled
      ? Math.max(0, Math.min(1, clamped * this.settings.volume))
      : 0.0;

    // If approaching and audio is paused, attempt play right away
    if (this.targetVolume > 0.005 && this.audio && this.audio.paused) {
      const p = this.audio.play();
      if (p !== undefined) {
        p.then(() => {
          this.isPlaying = true;
        }).catch(() => {
          // Will play on next user gesture
        });
      }
    }
  }

  /**
   * Manual trigger / unlock method if needed from user interactions (e.g. clicking UI buttons).
   */
  public triggerPlay(): void {
    if (this.audio && this.targetVolume > 0.005 && this.audio.paused) {
      this.audio.play().then(() => {
        this.isPlaying = true;
      }).catch(() => {});
    }
  }

  public updateSettings(newSettings: Partial<CharacterMusicSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.targetVolume = this.settings.enabled
      ? Math.max(0, Math.min(1, this.currentProximity * this.settings.volume))
      : 0.0;
  }

  public getSettings(): CharacterMusicSettings {
    return { ...this.settings };
  }

  public dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.audio) {
      this.audio.pause();
      if (this.audio.parentNode) {
        this.audio.parentNode.removeChild(this.audio);
      }
      this.audio.src = "";
      this.audio = null;
    }
    this.isPlaying = false;
    this.targetVolume = 0.0;
  }
}

export const characterMusicEngine = CharacterMusicEngine.getInstance();
