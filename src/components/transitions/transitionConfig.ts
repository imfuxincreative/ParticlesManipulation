"use client";

import { create } from "zustand";

export interface LoopTransitionConfig {
  enabled: boolean;
  duration: number; // manual test duration in ms (default: 700ms)
  zoneFrames: number; // gradual transition distance in frames (default: 120)
  maxBlurPx: number; // CSS backdrop blur in pixels (default: 42px)
  maxFogDensity: number; // Peak fog density in Three.js (default: 0.015)
  minExposure: number; // Lowest exposure factor at peak (default: 1.0)
  useShaderBlur: boolean; // Enable/disable WebGL shader bokeh pass (default: true)
  chromaticAberration: number; // Chromatic aberration strength (default: 0.02)
  zoomBlurStrength: number; // Zoom blur strength (default: 0.03)
  maskRadius: number; // Center mask radius (default: 0.0)
  maskFeather: number; // Mask feather (default: 0.25)
  flashStrength: number; // Subtle flash at peak (default: 0.0)
  showToBeContinued?: boolean; // Show "To Be Continued" UI overlay when screen is full red (default: true)
  toBeContinuedText?: string; // Text to display in transition overlay (default: "To Be Continued")
}

export type ActiveSceneId = "main" | "inTouch";
export type InTouchPhase = "idle" | "entering" | "active" | "exiting";

export interface LoopTransitionState {
  config: LoopTransitionConfig;
  isTransitioning: boolean;
  phase: "idle" | "in" | "out";
  transitionProgress: number; // 0.0 -> 1.0 (peak) -> 0.0
  blurStrength: number; // 0.0 to 1.0
  flashStrength: number; // 0.0 to 1.0
  exposureMultiplier: number; // 1.0 down to minExposure
  fogDensityMultiplier: number; // 1.0 up to maxFogDensity
  direction: "forward" | "backward";

  // Active scene lifecycle
  activeScene: ActiveSceneId;
  inTouchState: InTouchPhase;

  // Actions
  updateConfig: (partial: Partial<LoopTransitionConfig>) => void;
  triggerTransition: (direction: "forward" | "backward", onPeak?: () => void) => void;
  setProgress: (progress: number, phase?: "idle" | "in" | "out") => void;
  setActiveScene: (scene: ActiveSceneId) => void;
  setInTouchState: (state: InTouchPhase) => void;
  transitionToInTouch: (direction?: "forward" | "backward") => void;
  returnToMainScene: (target?: "last" | "first") => void;
  reset: () => void;
}

const DEFAULT_CONFIG: LoopTransitionConfig = {
  enabled: true,
  duration: 900,
  zoneFrames: 400,
  maxBlurPx: 64,
  maxFogDensity: 0.075,
  minExposure: 1.0,
  useShaderBlur: true,
  chromaticAberration: 0.02,
  zoomBlurStrength: 0.03,
  maskRadius: 0.0,
  maskFeather: 0.25,
  flashStrength: 0.0,
  showToBeContinued: false,
  toBeContinuedText: "to be continued",
};

let activeAnimFrame: number | null = null;

export const useLoopTransition = create<LoopTransitionState>((set, get) => ({
  config: DEFAULT_CONFIG,
  isTransitioning: false,
  phase: "idle",
  transitionProgress: 0.0,
  blurStrength: 0.0,
  flashStrength: 0.0,
  exposureMultiplier: 1.0,
  fogDensityMultiplier: 1.0,
  direction: "forward",

  activeScene: "main",
  inTouchState: "idle",

  setActiveScene: (scene) => set({ activeScene: scene }),
  setInTouchState: (state) => set({ inTouchState: state }),

  updateConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
  },

  setProgress: (progress, phase = "in") => {
    const clamped = Math.max(0, Math.min(1, progress));
    const cfg = get().config;
    set({
      transitionProgress: clamped,
      blurStrength: cfg.useShaderBlur ? clamped : 0.0,
      phase: clamped > 0.001 ? phase : "idle",
      isTransitioning: false, // Manual scroll progress does NOT lock out user input
      flashStrength: Math.sin(clamped * Math.PI) * (cfg.flashStrength || 0),
      exposureMultiplier: 1.0,
      fogDensityMultiplier: 1.0 + clamped * (cfg.maxFogDensity / 0.003 - 1.0),
    });
  },

  reset: () => {
    if (activeAnimFrame !== null) {
      cancelAnimationFrame(activeAnimFrame);
      activeAnimFrame = null;
    }
    set({
      isTransitioning: false,
      phase: "idle",
      transitionProgress: 0.0,
      blurStrength: 0.0,
      flashStrength: 0.0,
      exposureMultiplier: 1.0,
      fogDensityMultiplier: 1.0,
      activeScene: "main",
      inTouchState: "idle",
    });
  },

  transitionToInTouch: (direction: "forward" | "backward" = "forward") => {
    const state = get();
    if (state.activeScene === "inTouch" && !state.isTransitioning) return;

    if (activeAnimFrame !== null) {
      cancelAnimationFrame(activeAnimFrame);
      activeAnimFrame = null;
    }

    const duration = 900;
    const halfDuration = duration * 0.45;
    const startTime = performance.now();
    const startProgress = Math.max(0, Math.min(0.85, state.transitionProgress));

    set({
      isTransitioning: true,
      phase: "in",
      direction,
      inTouchState: "entering",
    });

    let peakCalled = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const cfg = get().config;

      if (elapsed < halfDuration) {
        // Phase IN: smoothly ramp mist and blur to peak 1.0
        const t = Math.min(1, elapsed / halfDuration);
        const smoothT = t * t * (3 - 2 * t);
        const p = startProgress + (1.0 - startProgress) * smoothT;
        set({
          phase: "in",
          transitionProgress: p,
          blurStrength: cfg.useShaderBlur ? p : 0.0,
          fogDensityMultiplier: 1.0 + p * (cfg.maxFogDensity / 0.003 - 1.0),
        });
        activeAnimFrame = requestAnimationFrame(tick);
      } else if (elapsed < duration) {
        if (!peakCalled) {
          peakCalled = true;
          // Set Lenis to end of timeline so seamless wrap is established
          if (typeof window !== "undefined" && (window as any).lenis) {
            const lenis = (window as any).lenis;
            if (lenis.limit > 0) {
              lenis.scrollTo(lenis.limit, { immediate: true });
            }
          }
          set({
            activeScene: "inTouch",
            inTouchState: "active",
            phase: "out",
          });
        }

        // Phase OUT: 1.0 -> 0.0 smoothly parting mist to reveal inTouch silhouette
        const outElapsed = elapsed - halfDuration;
        const outTotal = duration - halfDuration;
        const t = Math.min(1, outElapsed / outTotal);
        const p = 1.0 - t * t * (3 - 2 * t);
        set({
          phase: "out",
          transitionProgress: p,
          blurStrength: cfg.useShaderBlur ? p : 0.0,
          fogDensityMultiplier: 1.0 + p * (cfg.maxFogDensity / 0.003 - 1.0),
        });
        activeAnimFrame = requestAnimationFrame(tick);
      } else {
        activeAnimFrame = null;
        set({
          isTransitioning: false,
          phase: "idle",
          transitionProgress: 0.0,
          blurStrength: 0.0,
          activeScene: "inTouch",
          inTouchState: "active",
        });
      }
    };

    activeAnimFrame = requestAnimationFrame(tick);
  },

  returnToMainScene: (target: "last" | "first" = "first") => {
    const state = get();
    if (state.activeScene === "main" && !state.isTransitioning) return;

    if (activeAnimFrame !== null) {
      cancelAnimationFrame(activeAnimFrame);
      activeAnimFrame = null;
    }

    const duration = 900;
    const halfDuration = duration * 0.45;
    const startTime = performance.now();

    set({
      isTransitioning: true,
      phase: "in",
      direction: target === "last" ? "backward" : "forward",
      inTouchState: "exiting",
    });

    let peakCalled = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const cfg = get().config;

      if (elapsed < halfDuration) {
        // Phase IN: smoothly ramp red mist to peak (1.0)
        const t = Math.min(1, elapsed / halfDuration);
        const p = t * t * (3 - 2 * t);
        set({
          phase: "in",
          transitionProgress: p,
          blurStrength: cfg.useShaderBlur ? p : 0.0,
          fogDensityMultiplier: 1.0 + p * (cfg.maxFogDensity / 0.003 - 1.0),
        });
        activeAnimFrame = requestAnimationFrame(tick);
      } else if (elapsed < duration) {
        if (!peakCalled) {
          peakCalled = true;
          // Set scroll position at peak fog (100% hidden)
          if (typeof window !== "undefined" && (window as any).lenis) {
            const lenis = (window as any).lenis;
            if (target === "last") {
              // Return to the EXACT LAST FRAME of Scene 1 (~8868, right before 8871)
              const lastScroll = Math.max(0, lenis.limit - 15);
              lenis.scrollTo(lastScroll, { immediate: true });
              lenis.velocity = 0;
            } else {
              // Return to the FIRST FRAME of Scene 1 (-493)
              lenis.scrollTo(0, { immediate: true });
              lenis.velocity = 0;
            }
          }

          if (target === "last") {
            // When returning to last frame, the scene is already at peak scroll blur (1.0).
            // Directly hand off to the scroll-driven blur so the user's backward scroll smoothly unblurs it!
            activeAnimFrame = null;
            set({
              activeScene: "main",
              inTouchState: "idle",
              isTransitioning: false,
              phase: "idle",
              transitionProgress: 1.0,
              blurStrength: cfg.useShaderBlur ? 1.0 : 0.0,
              fogDensityMultiplier: cfg.maxFogDensity / 0.003,
            });
            return;
          }

          set({
            activeScene: "main",
            inTouchState: "idle",
            phase: "out",
          });
        }

        // Phase OUT (only for target === "first"): 1.0 -> 0.0 smoothly revealing Scene 1 from start frame
        const outElapsed = elapsed - halfDuration;
        const outTotal = duration - halfDuration;
        const t = Math.min(1, outElapsed / outTotal);
        const p = 1.0 - t * t * (3 - 2 * t);
        set({
          phase: "out",
          transitionProgress: p,
          blurStrength: cfg.useShaderBlur ? p : 0.0,
          fogDensityMultiplier: 1.0 + p * (cfg.maxFogDensity / 0.003 - 1.0),
        });
        activeAnimFrame = requestAnimationFrame(tick);
      } else {
        activeAnimFrame = null;
        set({
          isTransitioning: false,
          phase: "idle",
          transitionProgress: 0.0,
          blurStrength: 0.0,
          activeScene: "main",
          inTouchState: "idle",
        });
      }
    };

    activeAnimFrame = requestAnimationFrame(tick);
  },

  triggerTransition: (direction: "forward" | "backward", onPeak?: () => void) => {
    const state = get();
    if (state.isTransitioning) return;

    if (!state.config.enabled) {
      if (onPeak) onPeak();
      return;
    }

    if (activeAnimFrame !== null) {
      cancelAnimationFrame(activeAnimFrame);
      activeAnimFrame = null;
    }

    const duration = state.config.duration;
    const halfDuration = duration * 0.5;
    const startTime = performance.now();

    set({
      isTransitioning: true,
      phase: "in",
      direction,
      transitionProgress: 0.0,
      blurStrength: 0.0,
      flashStrength: 0.0,
      exposureMultiplier: 1.0,
      fogDensityMultiplier: 1.0,
    });

    let peakCalled = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const cfg = get().config;

      if (elapsed < halfDuration) {
        // Phase IN: 0.0 -> 1.0
        const t = Math.min(1, elapsed / halfDuration);
        // Smooth easeInOut curve (Hermite)
        const p = t * t * (3 - 2 * t);
        set({
          phase: "in",
          transitionProgress: p,
          blurStrength: cfg.useShaderBlur ? p : 0.0,
          flashStrength: Math.sin(p * Math.PI) * (cfg.flashStrength || 0),
          exposureMultiplier: 1.0 - p * (1.0 - cfg.minExposure),
          fogDensityMultiplier: 1.0 + p * (cfg.maxFogDensity / 0.003 - 1.0),
        });
        activeAnimFrame = requestAnimationFrame(tick);
      } else if (elapsed < duration) {
        // Peak reached
        if (!peakCalled) {
          peakCalled = true;
          set({
            transitionProgress: 1.0,
            blurStrength: cfg.useShaderBlur ? 1.0 : 0.0,
            phase: "out",
            exposureMultiplier: cfg.minExposure,
            fogDensityMultiplier: cfg.maxFogDensity / 0.003,
          });
          if (onPeak) {
            try {
              onPeak();
            } catch (err) {
              console.error("[LoopTransition] onPeak callback error:", err);
            }
          }
        }

        // Phase OUT: 1.0 -> 0.0
        const outElapsed = elapsed - halfDuration;
        const t = Math.min(1, outElapsed / halfDuration);
        const p = 1.0 - (t * t * (3 - 2 * t));
        set({
          phase: "out",
          transitionProgress: p,
          blurStrength: cfg.useShaderBlur ? p : 0.0,
          flashStrength: Math.sin(p * Math.PI) * (cfg.flashStrength || 0),
          exposureMultiplier: 1.0 - p * (1.0 - cfg.minExposure),
          fogDensityMultiplier: 1.0 + p * (cfg.maxFogDensity / 0.003 - 1.0),
        });
        activeAnimFrame = requestAnimationFrame(tick);
      } else {
        // Completed
        if (!peakCalled && onPeak) {
          onPeak();
        }
        activeAnimFrame = null;
        set({
          isTransitioning: false,
          phase: "idle",
          transitionProgress: 0.0,
          blurStrength: 0.0,
          flashStrength: 0.0,
          exposureMultiplier: 1.0,
          fogDensityMultiplier: 1.0,
        });
      }
    };

    activeAnimFrame = requestAnimationFrame(tick);
  },
}));

if (typeof window !== "undefined") {
  (window as any).__loopTransition = useLoopTransition;
}
