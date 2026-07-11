"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ModelParticleSystem } from "./ModelParticleSystem";
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
    visuals: {
      hazeColor: "#ff007f",       // Pink haze (Neon preset)
      xrayBorderColor: "#e91e63", // Pink borders
      xrayBaseColor: "#888888",
      xrayOutlineColor: "#ffffff",
      xrayFillOpacity: 0.15,
      xrayBorderOpacity: 0.5,
      skyColor: "#ff007f",
    },
  },
  // {
  //   path: "/cityhall.glb",
  //   hasParticleTarget: false,
  //   activeAnimationName: "Action",
  //   visuals: {
  //     hazeColor: "#050b14",       // Cyber deep blue background
  //     xrayBorderColor: "#ff7b00ff", // Bright neon blue borders (updated to user hex)
  //     xrayBaseColor: "#001b33",   // Deep indigo fill base
  //     xrayOutlineColor: "#ffab3dff", // Neon blue glow outlines
  //     xrayFillOpacity: 0.15,
  //     xrayBorderOpacity: 0.6,
  //     skyColor: "#0084ffff",
  //   },
  // },
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
    "xrayBorderColor", "skyColor",
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
  const boolKeys: (keyof SceneVisualOverrides)[] = ["showSky", "showGridFloor"];
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

  // Target meshes from Scene 1 (for ModelParticleSystem)
  const targetMeshesRef = useRef<THREE.Mesh[]>([]);
  const [targetMeshes, setTargetMeshes] = React.useState<THREE.Mesh[]>([]);

  // State-driven active scene to synchronize dashboard settings
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const transitionTimeRef = useRef(-1.0);
  const transitionFromRef = useRef(0);
  const transitionToRef = useRef(0);
  const initialInitRef = useRef(false);

  // Wrap-around transition tracking
  const prevLRef = useRef(0);
  const wrapStateRef = useRef({
    active: false,
    direction: "none" as "forward" | "backward" | "none",
    progress: 0.0,
    time: 0.0,
    fromScene: 0,
    toScene: 0
  });

  // Camera callbacks — stable refs per scene index
  const cameraCallbacksRef = useRef<((cam: THREE.PerspectiveCamera) => void)[]>([]);
  if (cameraCallbacksRef.current.length === 0) {
    for (let i = 0; i < NUM_SCENES; i++) {
      const idx = i;
      cameraCallbacksRef.current.push((cam: THREE.PerspectiveCamera) => {
        camerasRef.current[idx] = cam;
        if (idx === 0) {
          set({ camera: cam });
          console.log(`[SceneModel] Scene ${idx} camera set as initial active camera`);
        }
      });
    }
  }

  // Target meshes callback (Scene 1 only)
  const onTargetMeshes = useCallback((meshes: THREE.Mesh[]) => {
    targetMeshesRef.current = meshes;
    setTargetMeshes(meshes);
  }, []);

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

    // Wrap-around transition logic
    const currentL = (scrollData as any).scroll.current;
    const prevL = prevLRef.current;
    prevLRef.current = currentL;
    const wrapState = wrapStateRef.current;

    // Detect wrap triggers
    if (!wrapState.active) {
      if (currentL - prevL < -0.5) {
        // Forward wrap triggered (L.current jumped from ~1 to ~0)
        wrapState.active = true;
        wrapState.direction = "forward";
        wrapState.progress = 0.0;
        wrapState.time = 0.0;
        wrapState.fromScene = NUM_SCENES - 1;
        wrapState.toScene = 0;
        console.log("[SceneModel] Forward wrap detected! from:", wrapState.fromScene, "to:", wrapState.toScene);
      } else if (currentL - prevL > 0.5) {
        // Backward wrap triggered (L.current jumped from ~0 to ~1)
        wrapState.active = true;
        wrapState.direction = "backward";
        wrapState.progress = 0.0;
        wrapState.time = 0.0;
        wrapState.fromScene = 0;
        wrapState.toScene = NUM_SCENES - 1;
        console.log("[SceneModel] Backward wrap detected! from:", wrapState.fromScene, "to:", wrapState.toScene);
      }
    }

    const WRAP_DURATION = 0.6; // Transition duration in seconds

    if (wrapState.active) {
      wrapState.time += delta;
      wrapState.progress = THREE.MathUtils.clamp(wrapState.time / WRAP_DURATION, 0.0, 1.0);

      // Check for completion
      if (wrapState.progress >= 1.0) {
        wrapState.active = false;
        wrapState.direction = "none";
        wrapState.progress = 1.0;
        wrapState.time = 0.0;
        setActiveSceneIndex(wrapState.toScene);
        console.log("[SceneModel] Wrap complete.");
      }
    }

    // Wrap the raw scroll offset safely to [0, 1) range to prevent any index errors
    const tRaw = scrollData.offset;
    let t = ((tRaw % 1) + 1) % 1;

    // Override t during the wrap transition to lock it at start/end frames
    if (wrapState.active) {
      if (wrapState.direction === "forward") {
        t = wrapState.progress < 0.5 ? 1.0 : 0.0;
      } else if (wrapState.direction === "backward") {
        t = wrapState.progress < 0.5 ? 0.0 : 1.0;
      }
    }

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

    if (nextTarget !== activeSceneIndex && transitionTimeRef.current < 0 && !wrapState.active) {
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
    } else if (wrapState.active) {
      // Lock active camera and set incoming scene index during wrap transition
      const isPastPeak = wrapState.progress >= 0.5;
      activeCamIndex = isPastPeak ? wrapState.toScene : wrapState.fromScene;
      glUserData.incomingSceneIndex = isPastPeak ? wrapState.fromScene : wrapState.toScene;
    } else {
      glUserData.incomingSceneIndex = -1;
    }

    // Overlay the wrap transition progress and glitch if active
    if (wrapState.active) {
      const wrapGlitch = Math.sin(wrapState.progress * Math.PI) * 0.45;
      transitionGlitch = Math.max(transitionGlitch, wrapGlitch);
      transitionProgress = Math.max(transitionProgress, wrapState.progress);
    }

    // Write shared state
    glUserData.transitionProgress = transitionProgress;
    glUserData.activeSceneIndex = activeCamIndex;
    glUserData.bgGlitchActive = Math.max(glUserData.autoBgGlitchActive || 0.0, transitionGlitch);
    glUserData.bgGlitchSeed = transitionGlitch > (glUserData.autoBgGlitchActive || 0.0)
      ? Math.random() * 1000.0
      : (glUserData.autoBgGlitchSeed || 0.0);

    // Compute and blend visual overrides smoothly across scroll boundaries
    if (wrapState.active) {
      const fromVisuals = SCENE_CONFIGS[wrapState.fromScene]?.visuals;
      const toVisuals = SCENE_CONFIGS[wrapState.toScene]?.visuals;
      glUserData.sceneVisuals = lerpVisuals(fromVisuals, toVisuals, wrapState.progress);
    } else if (transitionTimeRef.current >= 0.0) {
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

    // Switch active R3F camera
    const targetCam = camerasRef.current[activeCamIndex];
    if (targetCam && state.camera !== targetCam) {
      set({ camera: targetCam });
      console.log(`[SceneModel] Camera switched to scene ${activeCamIndex}`);
    }

    // Keep all cameras' aspect ratios up to date
    for (let i = 0; i < NUM_SCENES; i++) {
      const cam = camerasRef.current[i];
      if (cam) {
        cam.aspect = size.width / size.height;
        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
      }
    }

    // Apply wrap-around vertical camera offset to make it feel like the camera moves down and enters from the bottom
    if (wrapState.active && targetCam) {
      const p = wrapState.progress;
      const MAX_OFFSET = 35.0; // Max height to offset camera

      if (wrapState.direction === "forward") {
        if (p < 0.5) {
          const tHalf = p / 0.5;
          targetCam.position.y -= MAX_OFFSET * tHalf;
        } else {
          const tHalf = (1.0 - p) / 0.5;
          targetCam.position.y += MAX_OFFSET * tHalf;
        }
      } else if (wrapState.direction === "backward") {
        if (p < 0.5) {
          const tHalf = p / 0.5;
          targetCam.position.y += MAX_OFFSET * tHalf;
        } else {
          const tHalf = (1.0 - p) / 0.5;
          targetCam.position.y -= MAX_OFFSET * tHalf;
        }
      }
      targetCam.updateMatrixWorld(true);
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
          onTargetMeshes={config.hasParticleTarget ? onTargetMeshes : undefined}
        />
      ))}

      {/* Glowing Sky Dome */}
      {settings.showSky && <SkyDome />}

      {/* Grid Floor */}
      {settings.showGridFloor && <GridFloor projectionBounds={cityProjectionBounds} />}

      {/* Target rendered with interactive particle system (Scene 1 only) */}
      {targetMeshes.length > 0 && (
        <ModelParticleSystem
          meshes={targetMeshes}
          targetNode={targetMeshes[0]}
          projectionBounds={cityProjectionBounds}
        />
      )}
    </>
  );
};
