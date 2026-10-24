"use client";

import { SoundCurves } from "./SoundParams";

export interface ScatterAnalysisResult {
  energy: number;            // 0.0 to 1.0 (Smoothed combined motion energy)
  speedNorm: number;         // 0.0 to 1.0 (Smoothed normalized speed of disturbed particles)
  densityNorm: number;       // 0.0 to 1.0 (Smoothed fraction of active particles)
  distanceNorm: number;      // 0.0 to 1.0 (Smoothed displacement from rest positions)
  rawSpeed: number;          // Unsmoothed average speed of active particles
  maxSpeed: number;          // Peak particle speed observed this frame
  activeCount: number;       // Number of disturbed particles this frame
  activeRatio: number;       // activeCount / totalCount
  avgDistance: number;       // Average displacement from rest position of active particles
  centroidX: number;         // Normalized centroid X for stereo panning [-1, 1]
  centroidY: number;         // Normalized centroid Y [-1, 1]
  centroidZ: number;         // Centroid Z in model coordinates
}

export interface ScatterAnalyzerOptions {
  speedSensitivity?: number; // Scaling factor for speed normalization (default: 1.0)
  distanceInfluence?: number;// Weight of displacement in combined energy (default: 0.45)
  attackTime?: number;       // Envelope attack time in seconds (default: 0.012)
  releaseTime?: number;      // Envelope release/tail time in seconds (default: 0.35)
  motionThreshold?: number;  // Minimum particle speed to be considered active (default: 0.0035)
  refSpeed?: number;         // Base reference speed for 1.0 speedNorm (default: 0.024)
  refDistance?: number;      // Base reference displacement for 1.0 distanceNorm (default: 1.8)
}

/**
 * ScatterAnalyzer: Real-time particle motion and displacement analysis.
 * Performs zero allocations per frame and features adaptive running-peak normalization
 * with asymmetric dual attack/release envelope smoothing.
 */
export class ScatterAnalyzer {
  // Pre-allocated output result object (zero GC allocations)
  private readonly result: ScatterAnalysisResult = {
    energy: 0.0,
    speedNorm: 0.0,
    densityNorm: 0.0,
    distanceNorm: 0.0,
    rawSpeed: 0.0,
    maxSpeed: 0.0,
    activeCount: 0,
    activeRatio: 0.0,
    avgDistance: 0.0,
    centroidX: 0.0,
    centroidY: 0.0,
    centroidZ: 0.0,
  };

  // Smoothed internal envelope states
  private smoothedEnergy = 0.0;
  private smoothedSpeed = 0.0;
  private smoothedDensity = 0.0;
  private smoothedDistance = 0.0;
  private smoothedCentroidX = 0.0;

  // Running adaptive peak speed tracker for consistent touch & mouse dynamics
  private runningMaxSpeed = 0.04;

  /**
   * Analyze particle buffers for this frame.
   *
   * @param pos Dynamic particle positions (Float32Array [x, y, z, ...])
   * @param rest Rest / home target positions (Float32Array [x, y, z, ...])
   * @param count Total number of particles
   * @param pSpeed Pointer velocity magnitude (secondary boost signal)
   * @param delta Frame time delta in seconds
   * @param options Tunable sensitivity, attack, and release parameters
   */
  public analyzeBuffers(
    pos: Float32Array,
    rest: Float32Array,
    count: number,
    pSpeed: number,
    delta: number,
    options?: ScatterAnalyzerOptions
  ): ScatterAnalysisResult {
    const dt = Math.max(0.001, Math.min(delta || 0.016, 0.1));
    const speedSens = options?.speedSensitivity ?? 1.0;
    const distInfluence = options?.distanceInfluence ?? 0.45;
    const attackTime = Math.max(0.002, options?.attackTime ?? 0.012);
    const releaseTime = Math.max(0.02, options?.releaseTime ?? 0.35);
    const motionThreshold = options?.motionThreshold ?? 0.0035;
    const baseRefSpeed = options?.refSpeed ?? 0.024;
    const baseRefDistance = options?.refDistance ?? 1.8;

    // Running peak speed decay (slowly adapts to touch/mouse drag velocity)
    this.runningMaxSpeed = Math.max(baseRefSpeed, this.runningMaxSpeed * Math.exp(-dt * 0.45));

    let activeCount = 0;
    let sumActiveSpeed = 0.0;
    let maxSpeed = 0.0;
    let sumDisplacement = 0.0;
    let weightedX = 0.0;
    let weightedY = 0.0;
    let weightedZ = 0.0;

    // Step through particles.
    // For 8100 particles, reading pos vs rest computes displacement directly.
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = ix + 1;
      const iz = ix + 2;

      const px = pos[ix];
      const py = pos[iy];
      const pz = pos[iz];

      const rx = rest[ix];
      const ry = rest[iy];
      const rz = rest[iz];

      const dx = px - rx;
      const dy = py - ry;
      const dz = pz - rz;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Displacement from home rest position
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        sumDisplacement += dist;
      }

      // We determine instantaneous motion by displacement and disturbance
      // The larger the displacement, the more particles contribute to scatter
      if (distSq > 0.0012) {
        activeCount++;
      }
    }

    // Pointer velocity contribution as secondary signal
    const pointerBoost = Math.min(1.0, (pSpeed || 0.0) * 1.5);

    // Calculate active metrics
    const activeRatio = count > 0 ? activeCount / count : 0.0;
    const avgDistance = count > 0 ? sumDisplacement / count : 0.0;

    // Incorporate running max speed adaptivity
    if (pointerBoost * 0.05 > this.runningMaxSpeed) {
      this.runningMaxSpeed = pointerBoost * 0.05;
    }

    // Normalized components
    // 1. Density: percentage of disturbed particles (saturates smoothly at ~35% disturbed)
    const rawDensityNorm = Math.min(1.0, (activeRatio / 0.35) * speedSens);

    // 2. Distance: how far particles have been blown away from rest home
    const rawDistanceNorm = Math.min(1.0, (avgDistance / baseRefDistance) * (1.0 + distInfluence));

    // 3. Speed: derived from pointer velocity + particle disturbance activity
    const effectiveSpeed = Math.max(pointerBoost * 0.04, avgDistance * 0.15);
    if (effectiveSpeed > this.runningMaxSpeed) {
      this.runningMaxSpeed = effectiveSpeed;
    }
    const currentRefSpeed = Math.max(baseRefSpeed, this.runningMaxSpeed * 0.85);
    const rawSpeedNorm = Math.min(1.0, (effectiveSpeed / currentRefSpeed) * speedSens);

    // Combine into unified raw energy with physical weighting
    // When pointer moves or particles scatter far, energy rises quickly
    const rawEnergy = Math.min(
      1.0,
      rawSpeedNorm * 0.45 +
      rawDensityNorm * 0.35 +
      rawDistanceNorm * 0.20 +
      pointerBoost * 0.15
    );

    // Asymmetric Dual Attack / Release Envelope Follower
    // Fast attack (immediate reaction to swipe/drag)
    // Slower release (smooth decay tail when particles drift back)
    const attackCoeff = 1.0 - Math.exp(-dt / attackTime);
    const releaseCoeff = 1.0 - Math.exp(-dt / releaseTime);

    // Energy smoothing
    if (rawEnergy > this.smoothedEnergy) {
      this.smoothedEnergy += (rawEnergy - this.smoothedEnergy) * attackCoeff;
    } else {
      this.smoothedEnergy += (rawEnergy - this.smoothedEnergy) * releaseCoeff;
    }

    // Speed smoothing
    if (rawSpeedNorm > this.smoothedSpeed) {
      this.smoothedSpeed += (rawSpeedNorm - this.smoothedSpeed) * attackCoeff;
    } else {
      this.smoothedSpeed += (rawSpeedNorm - this.smoothedSpeed) * releaseCoeff;
    }

    // Density smoothing
    if (rawDensityNorm > this.smoothedDensity) {
      this.smoothedDensity += (rawDensityNorm - this.smoothedDensity) * attackCoeff;
    } else {
      this.smoothedDensity += (rawDensityNorm - this.smoothedDensity) * releaseCoeff;
    }

    // Distance smoothing
    if (rawDistanceNorm > this.smoothedDistance) {
      this.smoothedDistance += (rawDistanceNorm - this.smoothedDistance) * attackCoeff;
    } else {
      this.smoothedDistance += (rawDistanceNorm - this.smoothedDistance) * releaseCoeff;
    }

    // If energy is microscopic, clamp cleanly to zero to stop scheduling and eliminate CPU burn
    if (this.smoothedEnergy < 0.0005) {
      this.smoothedEnergy = 0.0;
      this.smoothedSpeed = 0.0;
      this.smoothedDensity = 0.0;
      this.smoothedDistance = 0.0;
    }

    // Store in result struct
    this.result.energy = this.smoothedEnergy;
    this.result.speedNorm = this.smoothedSpeed;
    this.result.densityNorm = this.smoothedDensity;
    this.result.distanceNorm = this.smoothedDistance;
    this.result.rawSpeed = effectiveSpeed;
    this.result.maxSpeed = maxSpeed;
    this.result.activeCount = activeCount;
    this.result.activeRatio = activeRatio;
    this.result.avgDistance = avgDistance;

    return this.result;
  }

  /**
   * Reset all envelope states to zero.
   */
  public reset(): void {
    this.smoothedEnergy = 0.0;
    this.smoothedSpeed = 0.0;
    this.smoothedDensity = 0.0;
    this.smoothedDistance = 0.0;
    this.runningMaxSpeed = 0.04;
  }

  /**
   * Direct access to current analysis results without recomputing.
   */
  public getResult(): ScatterAnalysisResult {
    return this.result;
  }
}
