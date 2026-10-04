"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GridFloor } from "./GridFloor";
import { SkyDome } from "./SkyDome";
import { useSimulation } from "@/context/SimulationContext";
import { SceneSlot, SceneConfig, SceneVisualOverrides } from "./SceneSlot";

const SCENE_CONFIGS: SceneConfig[] = [
  {
    path: "/SCENE.glb",
    hasParticleTarget: true,
    activeAnimationName: "mixamo.com.003",
  },
];

SCENE_CONFIGS.forEach((cfg) => useGLTF.preload(cfg.path));

const GLITCH_DURATION = 0.15;
const TRANSITION_GLITCH_INTENSITY = 0.25;
const NUM_SCENES = SCENE_CONFIGS.length;

function getTempColor(val: string | THREE.Color | undefined, fallback: string): THREE.Color {
  if (!val) return new THREE.Color(fallback);
  if (val instanceof THREE.Color) return val.clone();

  let str = val;
  if (str.startsWith("#") && str.length === 9) {
    str = str.substring(0, 7);
  }
  return new THREE.Color(str);
}

function lerpVisuals(
  a: SceneVisualOverrides | undefined,
  b: SceneVisualOverrides | undefined,
  t: number
): SceneVisualOverrides {
  const from = a || {};
  const to = b || {};
  const result: SceneVisualOverrides = {};

  const colorKeys: (keyof SceneVisualOverrides)[] = [
    "xrayOutlineColor", "xrayBaseColor", "xrayBorderColor",
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

  const boolKeys: (keyof SceneVisualOverrides)[] = ["showGridFloor"];
  for (const key of boolKeys) {
    const fromVal = from[key];
    const toVal = to[key];
    if (fromVal !== undefined || toVal !== undefined) {
      (result as any)[key] = t < 0.5 ? (fromVal ?? toVal) : (toVal ?? fromVal);
    }
  }

  return result;
}

function getInterpolatedVisuals(t: number): SceneVisualOverrides | null {
  const segmentSize = 1.0 / NUM_SCENES;
  const fadeHalfWidth = 0.05;
  const wrappedT = ((t % 1) + 1) % 1;

  const activeSegment = Math.min(Math.floor(wrappedT / segmentSize), NUM_SCENES - 1);
  if (activeSegment < 0 || activeSegment >= NUM_SCENES) return null;

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

  return null;
}

export const SceneModel: React.FC = () => {
  const { set, size } = useThree();
  const scrollData = useScroll();
  const { settings, updateSettings } = useSimulation();

  const camerasRef = useRef<(THREE.PerspectiveCamera | null)[]>(
    new Array(NUM_SCENES).fill(null)
  );
  const baseFovRef = useRef<number>(0);

  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const transitionTimeRef = useRef(-1.0);
  const transitionFromRef = useRef(0);
  const transitionToRef = useRef(0);
  const initialInitRef = useRef(false);

  const cameraCallbacksRef = useRef<((cam: THREE.PerspectiveCamera) => void)[]>([]);
  if (cameraCallbacksRef.current.length === 0) {
    for (let i = 0; i < NUM_SCENES; i++) {
      const idx = i;
      cameraCallbacksRef.current.push((cam: THREE.PerspectiveCamera) => {
        camerasRef.current[idx] = cam;
        if (idx === 0 && baseFovRef.current === 0) {
          baseFovRef.current = cam.fov;
        }
        if (idx === 0) {
          set({ camera: cam });
        }
      });
    }
  }

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
    }
  }, [activeSceneIndex, updateSettings]);

  useFrame((state, delta) => {
    if (!scrollData) return;

    const glUserData = (state.gl as any).userData || {};
    if (!(state.gl as any).userData) {
      (state.gl as any).userData = glUserData;
    }

    const particlesRatio = typeof window !== "undefined" ? (window as any).particlesScrollRatio : undefined;
    const rawT = (typeof particlesRatio === "number" && !isNaN(particlesRatio)) ? particlesRatio : (scrollData ? scrollData.offset : 0);
    const t = THREE.MathUtils.clamp(rawT, 0.0, 1.0);

    const segmentSize = 1.0 / NUM_SCENES;
    const rawSceneIndex = Math.min(Math.floor(t / segmentSize), NUM_SCENES - 1);

    if (!initialInitRef.current) {
      initialInitRef.current = true;
      setActiveSceneIndex(rawSceneIndex);
      glUserData.transitionProgress = 0.0;
      glUserData.activeSceneIndex = rawSceneIndex;
      glUserData.incomingSceneIndex = -1;
    }

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
    }

    const sceneScrollNorms: number[] = [];
    for (let i = 0; i < NUM_SCENES; i++) {
      const segStart = i * segmentSize;
      const segEnd = (i + 1) * segmentSize;
      sceneScrollNorms.push(THREE.MathUtils.clamp((t - segStart) / (segEnd - segStart), 0.0, 1.0));
    }
    glUserData.sceneScrollNorms = sceneScrollNorms;

    let transitionGlitch = 0.0;
    let transitionProgress = 0.0;
    let activeCamIndex = activeSceneIndex;

    if (transitionTimeRef.current >= 0.0) {
      transitionTimeRef.current += delta;
      const progress = transitionTimeRef.current / GLITCH_DURATION;

      if (progress >= 1.0) {
        transitionTimeRef.current = -1.0;
        glUserData.incomingSceneIndex = -1;
      } else {
        transitionGlitch = Math.sin(progress * Math.PI) * TRANSITION_GLITCH_INTENSITY;
        transitionProgress = progress;

        const isPastPeak = progress >= 0.5;
        activeCamIndex = isPastPeak ? transitionToRef.current : transitionFromRef.current;
        glUserData.incomingSceneIndex = isPastPeak ? transitionFromRef.current : transitionToRef.current;
      }
    } else {
      glUserData.incomingSceneIndex = -1;
    }

    glUserData.transitionProgress = transitionProgress;
    glUserData.activeSceneIndex = activeCamIndex;
    glUserData.bgGlitchActive = Math.max(glUserData.autoBgGlitchActive || 0.0, transitionGlitch);
    glUserData.bgGlitchSeed = transitionGlitch > (glUserData.autoBgGlitchActive || 0.0)
      ? Math.random() * 1000.0
      : (glUserData.autoBgGlitchSeed || 0.0);

    if (transitionTimeRef.current >= 0.0) {
      const fromVisuals = SCENE_CONFIGS[transitionFromRef.current]?.visuals;
      const toVisuals = SCENE_CONFIGS[transitionToRef.current]?.visuals;
      glUserData.sceneVisuals = lerpVisuals(fromVisuals, toVisuals, transitionProgress);
    } else {
      glUserData.sceneVisuals = getInterpolatedVisuals(t);
    }

    const targetCam = camerasRef.current[activeCamIndex];
    if (targetCam && state.camera !== targetCam) {
      set({ camera: targetCam });
    }

    const DESIGN_ASPECT = 16 / 9;
    const currentAspect = size.width / size.height;
    for (let i = 0; i < NUM_SCENES; i++) {
      const cam = camerasRef.current[i];
      if (cam) {
        cam.aspect = currentAspect;
        if (baseFovRef.current > 0) {
          cam.fov = baseFovRef.current;
        }
        if (currentAspect < DESIGN_ASPECT) {
          cam.zoom = Math.max(0.5, currentAspect / DESIGN_ASPECT);
        } else {
          cam.zoom = 1;
        }
        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
      }
    }
  }, -1);

  const cityProjectionBounds = useMemo(() => {
    return { min: -100, max: 100 };
  }, []);

  return (
    <>
      {SCENE_CONFIGS.map((config, i) => (
        <SceneSlot
          key={config.path}
          config={config}
          sceneIndex={i}
          projectionBounds={cityProjectionBounds}
          onCameraReady={cameraCallbacksRef.current[i]}
        />
      ))}

      {/* Glowing Atmosphere Sky Dome */}
      <SkyDome />

      {/* Ghibli Grass & Environment */}
      <GridFloor projectionBounds={cityProjectionBounds} />
    </>
  );
};
