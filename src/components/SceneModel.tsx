"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GridFloor } from "./GridFloor";
import { SkyDome } from "./SkyDome";
import { useSimulation } from "@/context/SimulationContext";
import { SceneSlot, SceneConfig, SceneVisualOverrides } from "./SceneSlot";

// ─── Scene Configuration ────────────────────────────────────────────
// Add new scenes here. Each entry gets an equal share of the scroll range.
// Each scene's GLB must contain a "Camera" node. Visuals override global settings.
const SCENE_CONFIGS: SceneConfig[] = [
  {
    path: "/SCENE.glb",
    hasParticleTarget: true,
    activeAnimationName: "mixamo.com.003",
  },
];

// Preload all scene GLBs
SCENE_CONFIGS.forEach((cfg) => useGLTF.preload(cfg.path));

const GLITCH_DURATION = 0.15; // Glitch duration: ~0.10s to 0.20s (Fast burst)
const TRANSITION_GLITCH_INTENSITY = 0.25; // Keep intensity low
const NUM_SCENES = SCENE_CONFIGS.length;

// Helper to convert hex/string to THREE.Color reference
function getTempColor(val: string | THREE.Color | undefined, fallback: string): THREE.Color {
  if (!val) return new THREE.Color(fallback);
  if (val instanceof THREE.Color) return val.clone();

  let str = val;
  // Sanitize 8-character hex string (strip AA channel)
  if (str.startsWith("#") && str.length === 9) {
    str = str.substring(0, 7);
  }
  return new THREE.Color(str);
}

/**
 * Linearly interpolate between two SceneVisualOverrides objects.
 * Colors are smoothly interpolated using THREE.Color.lerp.
 */
function lerpVisuals(
  a: SceneVisualOverrides | undefined,
  b: SceneVisualOverrides | undefined,
  t: number
): SceneVisualOverrides {
  const from = a || {};
  const to = b || {};
  const result: SceneVisualOverrides = {};

  // Color properties: lerp smoothly using THREE.Color
  const colorKeys: (keyof SceneVisualOverrides)[] = [
    "hazeColor", "xrayOutlineColor", "xrayBaseColor",
    "xrayBorderColor", "skyColor", "fogColor",
  ];
  for (const key of colorKeys) {
    const fromVal = from[key];
    const toVal = to[key];
    if (fromVal !== undefined || toVal !== undefined) {
      const cFrom = getTempColor(fromVal as any, "#000000");
      const cTo = getTempColor(toVal as any, "#000000");
      cFrom.lerp(cTo, t);
      (result as any)[key] = cFrom;
    }
  }

  // Numeric properties: linear interpolation
  const numKeys: (keyof SceneVisualOverrides)[] = [
    "xrayFillOpacity", "xrayOutlinePower", "xrayScanlineIntensity",
    "xrayBorderOpacity", "xrayBorderThreshold", "xrayBorderRevealDepth",
    "xraySolidRevealDepth", "xrayHoverRadius", "gridFloorOpacity", "gridFloorY",
    "skyHorizonRange", "fogNear", "fogFar", "fogAmount",
  ];
  for (const key of numKeys) {
    const fromVal = from[key] as number | undefined;
    const toVal = to[key] as number | undefined;
    if (fromVal !== undefined && toVal !== undefined) {
      (result as any)[key] = fromVal + (toVal - fromVal) * t;
    } else if (fromVal !== undefined || toVal !== undefined) {
      (result as any)[key] = t < 0.5 ? (fromVal ?? toVal) : (toVal ?? fromVal);
    }
  }

  // Boolean properties: snap at midpoint
  const boolKeys: (keyof SceneVisualOverrides)[] = ["showSky", "showGridFloor", "showFog"];
  for (const key of boolKeys) {
    const fromVal = from[key];
    const toVal = to[key];
    if (fromVal !== undefined || toVal !== undefined) {
      (result as any)[key] = t < 0.5 ? (fromVal ?? toVal) : (toVal ?? fromVal);
    }
  }

  return result;
}

/**
 * Compute the interpolated visuals at a given scroll position t.
 * If we are NOT in a transition zone, return null to let the user tweak the active scene settings directly.
 */
function getInterpolatedVisuals(t: number): SceneVisualOverrides | null {
  const segmentSize = 1.0 / NUM_SCENES;
  const fadeHalfWidth = 0.05; // 5% scroll buffer on each side (10% total transition window)

  // Wrap t to [0, 1) range to support infinite scrolling and avoid indexing out of bounds
  const wrappedT = ((t % 1) + 1) % 1;

  // Find active segment
  const activeSegment = Math.min(Math.floor(wrappedT / segmentSize), NUM_SCENES - 1);
  if (activeSegment < 0 || activeSegment >= NUM_SCENES) return null;

  // Check boundary transition forward
  const nextSegment = activeSegment + 1;
  if (nextSegment < NUM_SCENES) {
    const boundary = nextSegment * segmentSize;
    if (wrappedT >= boundary - fadeHalfWidth && wrappedT <= boundary + fadeHalfWidth) {
      const factor = (wrappedT - (boundary - fadeHalfWidth)) / (fadeHalfWidth * 2.0);
      return lerpVisuals(
        SCENE_CONFIGS[activeSegment].visuals,
        SCENE_CONFIGS[nextSegment].visuals,
        factor
      );
    }
  }

  // Check boundary transition backward
  const prevSegment = activeSegment - 1;
  if (prevSegment >= 0) {
    const boundary = activeSegment * segmentSize;
    if (wrappedT >= boundary - fadeHalfWidth && wrappedT <= boundary + fadeHalfWidth) {
      const factor = (wrappedT - (boundary - fadeHalfWidth)) / (fadeHalfWidth * 2.0);
      return lerpVisuals(
        SCENE_CONFIGS[prevSegment].visuals,
        SCENE_CONFIGS[activeSegment].visuals,
        factor
      );
    }
  }

  // Not in transition zone: return null to let global state take over
  return null;
}

/**
 * SceneModel — Multi-Scene Orchestrator
 *
 * Renders N scenes via <SceneSlot>, manages scroll segments,
 * one-shot glitch transitions between scenes, and per-scene visual overrides.
 */
export const SceneModel: React.FC = () => {
  const { set, size } = useThree();
  const scrollData = useScroll();
  const { settings, updateSettings, updateSetting } = useSimulation();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Camera storage: one per scene
  const camerasRef = useRef<(THREE.PerspectiveCamera | null)[]>(
    new Array(NUM_SCENES).fill(null)
  );
  const baseFovRef = useRef<number>(0); // Original FOV for responsive scaling

  // State-driven active scene to synchronize dashboard settings
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const transitionTimeRef = useRef(-1.0);
  const transitionFromRef = useRef(0);
  const transitionToRef = useRef(0);
  const initialInitRef = useRef(false);
  // Initial scroll position is initialized to frame 0 by LenisScrollAdapter.



  // Camera callbacks — stable refs per scene index
  const cameraCallbacksRef = useRef<((cam: THREE.PerspectiveCamera) => void)[]>([]);
  if (cameraCallbacksRef.current.length === 0) {
    for (let i = 0; i < NUM_SCENES; i++) {
      const idx = i;
      cameraCallbacksRef.current.push((cam: THREE.PerspectiveCamera) => {
        camerasRef.current[idx] = cam;
        // Store the original Blender camera FOV for responsive scaling
        if (idx === 0 && baseFovRef.current === 0) {
          baseFovRef.current = cam.fov;
        }
        if (idx === 0) {
          set({ camera: cam });
          console.log(`[SceneModel] Scene ${idx} camera set as initial active camera`);
        }
      });
    }
  }

  // Synchronize dashboard settings to active scene visuals when scene changes.
  // We trigger this immediately when activeSceneIndex changes to prepare the settings
  // for the fall-back once transition completes and scroll leaves the border zone.
  useEffect(() => {
    const visuals = SCENE_CONFIGS[activeSceneIndex]?.visuals || {};
    const overrides: Partial<typeof settings> = {};

    Object.entries(visuals).forEach(([key, val]) => {
      if (val !== undefined) {
        if (val && (val as any).isColor) {
          (overrides as any)[key] = "#" + (val as THREE.Color).getHexString();
        } else if (typeof val === "string" && val.startsWith("#") && val.length === 9) {
          (overrides as any)[key] = val.substring(0, 7);
        } else {
          (overrides as any)[key] = val;
        }
      }
    });

    if (Object.keys(overrides).length > 0) {
      updateSettings(overrides);
      console.log(`[SceneModel] Synced dashboard settings for Scene ${activeSceneIndex}`, overrides);
    }
  }, [activeSceneIndex, updateSettings]);

  // Main orchestration loop
  useFrame((state, delta) => {
    if (!scrollData) return;

    const glUserData = (state.gl as any).userData || {};
    if (!(state.gl as any).userData) {
      (state.gl as any).userData = glUserData;
    }



    // Handle instant wrap-around loop scroll
    const scrollDataAny = scrollData as any;
    const el = scrollData.el;
    const maxScroll = el.scrollHeight - el.clientHeight;

    if (maxScroll > 0) {
      if (el.scrollTop >= maxScroll) {
        el.scrollTop = 1;
        if (scrollDataAny.scroll) scrollDataAny.scroll.current = 0.0;
        scrollDataAny.offset = 0.0;
      } else if (el.scrollTop <= 0) {
        el.scrollTop = maxScroll - 1;
        if (scrollDataAny.scroll) scrollDataAny.scroll.current = 1.0;
        scrollDataAny.offset = 1.0;
      }
    }

    // Clamp the raw scroll offset safely to [0, 1] range to prevent any index errors
    const t = THREE.MathUtils.clamp(scrollData.offset, 0.0, 1.0);

    // Compute which scene index the scroll is in
    const segmentSize = 1.0 / NUM_SCENES;
    const rawSceneIndex = Math.min(Math.floor(t / segmentSize), NUM_SCENES - 1);

    // Initialize on first frame without triggering glitch
    if (!initialInitRef.current) {
      initialInitRef.current = true;
      setActiveSceneIndex(rawSceneIndex);
      glUserData.transitionProgress = 0.0;
      glUserData.activeSceneIndex = rawSceneIndex;
      glUserData.incomingSceneIndex = -1;
    }

    // Detect scene boundary crossing → trigger one-shot glitch (Hysteresis check)
    // To trigger transitioning to next scene: must scroll slightly past segment size.
    const isPastUpperThreshold = t > (activeSceneIndex + 1) * segmentSize + 0.01;
    const isPastLowerThreshold = t < activeSceneIndex * segmentSize - 0.01;

    let nextTarget = activeSceneIndex;
    if (isPastUpperThreshold && activeSceneIndex + 1 < NUM_SCENES) {
      nextTarget = activeSceneIndex + 1;
    } else if (isPastLowerThreshold && activeSceneIndex - 1 >= 0) {
      nextTarget = activeSceneIndex - 1;
    }

    if (nextTarget !== activeSceneIndex && transitionTimeRef.current < 0) {
      transitionFromRef.current = activeSceneIndex;
      transitionToRef.current = nextTarget;
      setActiveSceneIndex(nextTarget);
      transitionTimeRef.current = 0.0;
      console.log(`[SceneModel] One-shot transition triggered: scene ${transitionFromRef.current} → ${transitionToRef.current}`);
    }

    // Compute per-scene scroll norms
    const sceneScrollNorms: number[] = [];
    for (let i = 0; i < NUM_SCENES; i++) {
      const segStart = i * segmentSize;
      const segEnd = (i + 1) * segmentSize;
      sceneScrollNorms.push(THREE.MathUtils.clamp((t - segStart) / (segEnd - segStart), 0.0, 1.0));
    }
    glUserData.sceneScrollNorms = sceneScrollNorms;

    // Process one-shot transition animation
    let transitionGlitch = 0.0;
    let transitionProgress = 0.0;
    let activeCamIndex = activeSceneIndex;

    if (transitionTimeRef.current >= 0.0) {
      transitionTimeRef.current += delta;
      const progress = transitionTimeRef.current / GLITCH_DURATION;

      if (progress >= 1.0) {
        transitionTimeRef.current = -1.0; // Transition complete
        glUserData.incomingSceneIndex = -1;
      } else {
        // Bell-curve glitch strength peaking at 0.5
        transitionGlitch = Math.sin(progress * Math.PI) * TRANSITION_GLITCH_INTENSITY;
        transitionProgress = progress;

        // Camera cut at peak of glitch
        const isPastPeak = progress >= 0.5;
        activeCamIndex = isPastPeak ? transitionToRef.current : transitionFromRef.current;
        glUserData.incomingSceneIndex = isPastPeak ? transitionFromRef.current : transitionToRef.current;
      }
    } else {
      glUserData.incomingSceneIndex = -1;
    }



    // Write shared state
    glUserData.transitionProgress = transitionProgress;
    glUserData.activeSceneIndex = activeCamIndex;
    glUserData.bgGlitchActive = Math.max(glUserData.autoBgGlitchActive || 0.0, transitionGlitch);
    glUserData.bgGlitchSeed = transitionGlitch > (glUserData.autoBgGlitchActive || 0.0)
      ? Math.random() * 1000.0
      : (glUserData.autoBgGlitchSeed || 0.0);

    // Compute and blend visual overrides smoothly across scroll boundaries
    if (transitionTimeRef.current >= 0.0) {
      const fromVisuals = SCENE_CONFIGS[transitionFromRef.current]?.visuals;
      const toVisuals = SCENE_CONFIGS[transitionToRef.current]?.visuals;
      glUserData.sceneVisuals = lerpVisuals(fromVisuals, toVisuals, transitionProgress);
    } else {
      // Transition is inactive: get scroll-interpolated visuals, or null (to fall back to SimulationSettings)
      glUserData.sceneVisuals = getInterpolatedVisuals(t);
    }

    // Render the smooth background haze transition in real-time
    const currentHazeColor = glUserData.sceneVisuals?.hazeColor || settingsRef.current.hazeColor;
    if (state.scene.background && (state.scene.background as any).isColor) {
      (state.scene.background as THREE.Color).set(currentHazeColor as THREE.Color);
    }

    // Dynamic environmental fog update for standard materials (such as Simon's bodypart mesh)
    const showFogVal = glUserData.sceneVisuals?.showFog !== undefined ? glUserData.sceneVisuals.showFog : settingsRef.current.showFog;
    const fogColorVal = glUserData.sceneVisuals?.fogColor ?? settingsRef.current.fogColor;
    const fogNearVal = glUserData.sceneVisuals?.fogNear !== undefined ? glUserData.sceneVisuals.fogNear : settingsRef.current.fogNear;
    const fogFarVal = glUserData.sceneVisuals?.fogFar !== undefined ? glUserData.sceneVisuals.fogFar : settingsRef.current.fogFar;

    if (showFogVal) {
      if (!state.scene.fog || !(state.scene.fog instanceof THREE.Fog)) {
        state.scene.fog = new THREE.Fog(fogColorVal, fogNearVal, fogFarVal);
      } else {
        const fog = state.scene.fog as THREE.Fog;
        fog.color.set(fogColorVal);
        fog.near = fogNearVal;
        fog.far = fogFarVal;
      }
    } else {
      state.scene.fog = null;
    }

    // Switch active R3F camera
    const targetCam = camerasRef.current[activeCamIndex];
    if (targetCam && state.camera !== targetCam) {
      set({ camera: targetCam });
      console.log(`[SceneModel] Camera switched to scene ${activeCamIndex}`);
    }

    // Keep all cameras' aspect ratios + responsive zoom up to date.
    // Zoom out uniformly on narrow viewports — preserves perspective exactly.
    const DESIGN_ASPECT = 16 / 9;
    const currentAspect = size.width / size.height;
    for (let i = 0; i < NUM_SCENES; i++) {
      const cam = camerasRef.current[i];
      if (cam) {
        cam.aspect = currentAspect;

        // Restore original FOV
        if (baseFovRef.current > 0) {
          cam.fov = baseFovRef.current;
        }

        // Uniform zoom: 1.0 on desktop, scales down on narrow viewports
        if (currentAspect < DESIGN_ASPECT) {
          cam.zoom = Math.max(0.5, currentAspect / DESIGN_ASPECT);
        } else {
          cam.zoom = 1;
        }

        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
      }
    }



    // Maintain model index 0 during active play
    if (settingsRef.current.currentModelIndex !== 0) {
      updateSetting('currentModelIndex', 0);
    }
  }, -1);

  // Projection bounds from Scene 1's city meshes (used by all systems)
  const cityProjectionBounds = useMemo(() => {
    return { min: -100, max: 100 };
  }, []);

  return (
    <>
      {/* Render all scene slots */}
      {SCENE_CONFIGS.map((config, i) => (
        <SceneSlot
          key={config.path}
          config={config}
          sceneIndex={i}
          projectionBounds={cityProjectionBounds}
          onCameraReady={cameraCallbacksRef.current[i]}
        />
      ))}

      {/* Glowing Sky Dome */}
      {settings.showSky && <SkyDome />}

      {/* Grid Floor */}
      {settings.showGridFloor && <GridFloor projectionBounds={cityProjectionBounds} />}
    </>
  );
};
