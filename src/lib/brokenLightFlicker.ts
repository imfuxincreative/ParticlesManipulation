import * as THREE from "three";
import { AtmosphereConfig, BrokenLightStyle } from "./atmosphere";

export interface BrokenLightState {
  multiplier: number;
  isGlitching: boolean;
  activeEventType: string | null;
}

class BrokenLightFlickerEngine {
  private multiplier = 1.0;
  private currentStyle: BrokenLightStyle = "faulty_neon";
  private time = 0;
  private timeUntilNextEvent = 0.8;
  private isGlitching = false;
  private activeEventType: string | null = null;
  private eventElapsed = 0;
  private eventDuration = 0;
  private subTimer = 0;
  private subState = false;
  private subValue = 1.0;

  public triggerSparkBurst(forcedType?: string): void {
    this.isGlitching = true;
    this.activeEventType = forcedType || "multi_stutter";
    this.eventElapsed = 0;
    this.eventDuration = 0.25 + Math.random() * 0.35;
    this.subTimer = 0;
    this.subState = false;
    this.subValue = 0.05;
  }

  public getMultiplier(): number {
    return this.multiplier;
  }

  public getState(): BrokenLightState {
    return {
      multiplier: this.multiplier,
      isGlitching: this.isGlitching,
      activeEventType: this.activeEventType,
    };
  }

  public update(
    delta: number,
    config: Pick<
      AtmosphereConfig,
      | "brokenLightEnabled"
      | "brokenLightIntensity"
      | "brokenLightSpeed"
      | "brokenLightSurge"
      | "brokenLightStyle"
    >,
    isInScope: boolean
  ): number {
    // If disabled or not in active scene scope, smoothly return to 1.0
    if (!config.brokenLightEnabled || !isInScope) {
      this.isGlitching = false;
      this.activeEventType = null;
      this.multiplier = THREE.MathUtils.damp(this.multiplier, 1.0, 10.0, delta);
      return this.multiplier;
    }

    const safeDelta = Math.min(delta, 0.1);
    this.time += safeDelta;
    const speed = Math.max(0.1, config.brokenLightSpeed ?? 1.0);
    const intensity = Math.max(0.0, Math.min(1.0, config.brokenLightIntensity ?? 0.9));
    const surgeMax = Math.max(1.1, config.brokenLightSurge ?? 1.85);
    const style = config.brokenLightStyle || "faulty_neon";

    let rawValue = 1.0;

    // Subtle 120Hz phosphor AC hum and micro-jitter in steady state
    const hum = Math.sin(this.time * 120.0) * 0.018 + Math.sin(this.time * 47.0) * 0.012;
    const microFuzz = (Math.random() - 0.5) * 0.02;

    if (!this.isGlitching) {
      this.timeUntilNextEvent -= safeDelta * speed;
      rawValue = 1.0 + hum + microFuzz;

      if (this.timeUntilNextEvent <= 0) {
        // Trigger a new physical glitch event
        this.isGlitching = true;
        this.eventElapsed = 0;
        this.subTimer = 0;

        // Pick event type based on selected aesthetic style
        const roll = Math.random();
        if (style === "erratic_strobe") {
          this.activeEventType = roll < 0.6 ? "multi_stutter" : "chaotic_short";
          this.eventDuration = 0.2 + Math.random() * 0.4;
        } else if (style === "electrical_short") {
          this.activeEventType = roll < 0.5 ? "chaotic_short" : "arc_surge";
          this.eventDuration = 0.15 + Math.random() * 0.35;
        } else if (style === "fluorescent_arc") {
          if (roll < 0.4) this.activeEventType = "deep_brownout";
          else if (roll < 0.7) this.activeEventType = "multi_stutter";
          else this.activeEventType = "arc_surge";
          this.eventDuration = 0.2 + Math.random() * 0.3;
        } else {
          // "faulty_neon" (default) - beautifully balanced cinematic glitch
          if (roll < 0.38) this.activeEventType = "multi_stutter";
          else if (roll < 0.65) this.activeEventType = "deep_brownout";
          else if (roll < 0.85) this.activeEventType = "arc_surge";
          else this.activeEventType = "chaotic_short";
          this.eventDuration = 0.18 + Math.random() * 0.35;
        }
      }
    } else {
      // Glitch event execution
      this.eventElapsed += safeDelta;
      this.subTimer += safeDelta;

      switch (this.activeEventType) {
        case "multi_stutter": {
          // Rapid alternating off-and-on chops (30ms - 55ms per chop)
          const stepInterval = 0.038 + Math.random() * 0.02;
          if (this.subTimer >= stepInterval) {
            this.subTimer = 0;
            this.subState = !this.subState;
            // Alternates between near-blackout and blinding overvoltage flash
            this.subValue = this.subState
              ? surgeMax * (0.85 + Math.random() * 0.3)
              : 0.04 + Math.random() * 0.12;
          }
          rawValue = this.subValue;
          break;
        }

        case "deep_brownout": {
          // Ballast collapses to low voltage, shudders, then snaps back with a surge
          const progress = this.eventElapsed / Math.max(0.01, this.eventDuration);
          if (progress < 0.8) {
            // Near total blackout with low-frequency tremble
            rawValue = 0.05 + Math.sin(this.time * 80.0) * 0.04 + Math.random() * 0.04;
          } else {
            // Re-ignition arc flash flare
            const arcProgress = (progress - 0.8) / 0.2;
            rawValue = THREE.MathUtils.lerp(surgeMax * 1.15, 1.0, arcProgress);
          }
          break;
        }

        case "arc_surge": {
          // Instantaneous electrical spike to high exposure followed by brief blackout dip
          const progress = this.eventElapsed / Math.max(0.01, this.eventDuration);
          if (progress < 0.35) {
            // High-exposure flash
            rawValue = surgeMax * (0.95 + Math.random() * 0.2);
          } else if (progress < 0.65) {
            // Immediate blackout cut
            rawValue = 0.02 + Math.random() * 0.08;
          } else {
            // Exponential recovery to normal
            const t = (progress - 0.65) / 0.35;
            rawValue = THREE.MathUtils.lerp(0.4, 1.0, Math.pow(t, 0.7));
          }
          break;
        }

        case "chaotic_short": {
          // Step-sampled random noise mimicking erratic loose connection
          if (this.subTimer >= 0.032) {
            this.subTimer = 0;
            const r = Math.random();
            if (r < 0.45) {
              this.subValue = 0.02 + Math.random() * 0.15; // drop
            } else if (r < 0.8) {
              this.subValue = surgeMax * (0.8 + Math.random() * 0.35); // surge
            } else {
              this.subValue = 0.7 + Math.random() * 0.35;
            }
          }
          rawValue = this.subValue;
          break;
        }

        default:
          rawValue = 1.0;
          break;
      }

      // Check if event concluded
      if (this.eventElapsed >= this.eventDuration) {
        this.isGlitching = false;
        this.activeEventType = null;
        // Schedule next random fault event (0.5s to 3.2s modulated by speed)
        this.timeUntilNextEvent = (0.5 + Math.random() * 2.7) / speed;
      }
    }

    // Apply intensity modulation:
    // If rawValue < 1.0 (drop), intensity controls how close to 0 it drops.
    // If rawValue > 1.0 (surge), surge intensity controls how high it flares.
    let finalMultiplier: number;
    if (rawValue < 1.0) {
      finalMultiplier = 1.0 - (1.0 - rawValue) * intensity;
    } else {
      finalMultiplier = 1.0 + (rawValue - 1.0) * intensity;
    }

    // Protect against non-finite or negative values
    this.multiplier = Math.max(0.0, Math.min(finalMultiplier, 3.5));
    return this.multiplier;
  }
}

export const brokenLightEngine = new BrokenLightFlickerEngine();
