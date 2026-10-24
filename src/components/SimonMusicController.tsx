"use client";

import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { characterMusicEngine } from "@/lib/audio/CharacterMusicEngine";
import { useSimulation } from "@/context/SimulationContext";
import { useLoopTransition } from "@/components/transitions/transitionConfig";
import { getFrameFromScrollOffset } from "@/config/navigationConfig";

interface SimonMusicControllerProps {
  meshes: THREE.Mesh[];
  sceneIndex: number;
}

const _camPos = new THREE.Vector3();
const _meshPos = new THREE.Vector3();

// Known world anchor positions for Simon in the scene
const STANDING_SIMON_POS = new THREE.Vector3(1540.68, 501.94, 6.22);
const HOVER_SIMON_POS = new THREE.Vector3(533.82, 3.95, -5.32);

/**
 * Calculates smooth Hermite curve proximity for an active frame interval.
 * Fades in between start and fullStart, stays 1.0 through fullEnd, and fades out between fullEnd and end.
 */
function calcRangeProximity(
  frame: number,
  start: number,
  fullStart: number,
  fullEnd: number,
  end: number
): number {
  if (frame < start || frame > end) return 0.0;
  if (frame >= fullStart && frame <= fullEnd) return 1.0;
  if (frame < fullStart) {
    const t = (frame - start) / (fullStart - start);
    return t * t * (3 - 2 * t);
  } else {
    const t = (end - frame) / (end - fullEnd);
    return t * t * (3 - 2 * t);
  }
}

export const SimonMusicController: React.FC<SimonMusicControllerProps> = ({ meshes, sceneIndex }) => {
  const { settings } = useSimulation();
  const lastProximityRef = useRef(-1);

  // Sync settings whenever context values change
  useEffect(() => {
    characterMusicEngine.updateSettings({
      enabled: settings.characterMusicEnabled,
      volume: settings.characterMusicVolume,
      nearDistance: settings.characterMusicNearDistance,
      farDistance: settings.characterMusicFarDistance,
    });
  }, [
    settings.characterMusicEnabled,
    settings.characterMusicVolume,
    settings.characterMusicNearDistance,
    settings.characterMusicFarDistance,
  ]);

  // Clean up when unmounting
  useEffect(() => {
    return () => {
      characterMusicEngine.updateProximity(0.0);
    };
  }, []);

  useFrame((state) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // Check if in main scene (music should not play while inside inTouch scene)
    const activeScene = useLoopTransition.getState().activeScene;
    if (activeScene !== "main") {
      if (lastProximityRef.current !== 0) {
        lastProximityRef.current = 0;
        characterMusicEngine.updateProximity(0.0);
      }
      return;
    }

    const isVisible = sceneIndex === activeSceneIndex || sceneIndex === incomingSceneIndex;
    if (!isVisible) {
      if (lastProximityRef.current !== 0) {
        lastProximityRef.current = 0;
        characterMusicEngine.updateProximity(0.0);
      }
      return;
    }

    // 1. Frame-based proximity
    let currentFrame =
      typeof window !== "undefined"
        ? (window as any).particlesCurrentFrame
        : undefined;

    if (typeof currentFrame !== "number") {
      const scrollNorms = glUserData.sceneScrollNorms || [];
      const scrollNorm = scrollNorms[sceneIndex] ?? 0.0;
      currentFrame = getFrameFromScrollOffset(scrollNorm);
    }

    // Range 1: Hover / Skating Simon (around frames 1100 to 1850)
    const hoverProx = calcRangeProximity(currentFrame, 1050, 1220, 1720, 1900);

    // Range 2: Standing Simon with TV screens (around frames 2800 to 4100, screenshot at ~3200)
    const standingProx = calcRangeProximity(currentFrame, 2750, 3000, 3950, 4200);

    const frameProximity = Math.max(hoverProx, standingProx);

    // 2. Spatial 3D distance-based proximity
    state.camera.getWorldPosition(_camPos);

    let minDist = Infinity;

    // Check distance to fixed Simon positions
    const distStanding = _camPos.distanceTo(STANDING_SIMON_POS);
    const distHover = _camPos.distanceTo(HOVER_SIMON_POS);
    minDist = Math.min(distStanding, distHover);

    // Also check distance to any Simon meshes passed as props
    if (meshes && meshes.length > 0) {
      const len = meshes.length;
      for (let i = 0; i < len; i++) {
        const mesh = meshes[i];
        if (!mesh) continue;
        mesh.getWorldPosition(_meshPos);
        const d = _camPos.distanceTo(_meshPos);
        if (d < minDist) {
          minDist = d;
        }
      }
    }

    const nearDist = settings.characterMusicNearDistance ?? 45.0;
    const farDist = settings.characterMusicFarDistance ?? 160.0;

    let spatialProximity = 0.0;
    if (minDist <= nearDist) {
      spatialProximity = 1.0;
    } else if (minDist >= farDist) {
      spatialProximity = 0.0;
    } else {
      const t = (farDist - minDist) / (farDist - nearDist);
      spatialProximity = t * t * (3 - 2 * t);
    }

    // Combine both: proximity is high if close in 3D OR at the Simon section on scroll
    const combinedProximity = Math.max(frameProximity, spatialProximity);

    // Update audio engine if change is noticeable
    if (
      Math.abs(combinedProximity - lastProximityRef.current) > 0.002 ||
      (combinedProximity === 0 && lastProximityRef.current > 0)
    ) {
      lastProximityRef.current = combinedProximity;
      characterMusicEngine.updateProximity(combinedProximity);
    }
  });

  return null;
};
