"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CALLOUT_TARGETS } from "@/config/targetConfig";
import { projectToScreen } from "@/utils/projectToScreen";

/**
 * TargetOverlayBridge
 *
 * R3F component that runs inside the Canvas. Every frame it:
 * 1. Reads world positions of target objects from the GLB scene
 * 2. Projects them to screen-space pixel coordinates
 * 3. Dispatches a CustomEvent so the DOM overlay layer can position SVG + labels
 *
 * Mount this inside the <group> that contains <primitive object={gltf.scene} />.
 */
interface TargetOverlayBridgeProps {
  scene: THREE.Object3D;
}

// Reusable world-position vector (avoids GC churn)
const _worldPos = new THREE.Vector3();

export const TargetOverlayBridge: React.FC<TargetOverlayBridgeProps> = ({
  scene,
}) => {
  const { camera, size } = useThree();
  const targetObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const lastJsonRef = useRef<string>("");

  // Discover target objects from the GLTF scene graph on mount
  useEffect(() => {
    const map = new Map<string, THREE.Object3D>();

    for (const config of CALLOUT_TARGETS) {
      const obj = scene.getObjectByName(config.id);
      if (obj) {
        map.set(config.id, obj);
        console.log(
          `[TargetOverlayBridge] Found target "${config.id}" in scene`
        );
      } else {
        console.warn(
          `[TargetOverlayBridge] Target "${config.id}" NOT found in scene`
        );
      }
    }

    targetObjectsRef.current = map;
  }, [scene]);

  // Every frame: project target world positions → screen coords → dispatch event
  useFrame(() => {
    const positions: Record<string, { x: number; y: number }> = {};

    for (const [id, obj] of targetObjectsRef.current) {
      // Read the updated world position (accounts for animations, parenting, etc.)
      obj.getWorldPosition(_worldPos);

      const screenPos = projectToScreen(_worldPos, camera, size);
      if (screenPos) {
        // Round to 1 decimal place to suppress sub-pixel jitter noise
        positions[id] = {
          x: Math.round(screenPos.x * 10) / 10,
          y: Math.round(screenPos.y * 10) / 10,
        };
      }
    }

    // Only dispatch if data changed (avoid unnecessary DOM updates)
    const json = JSON.stringify(positions);
    if (json !== lastJsonRef.current) {
      lastJsonRef.current = json;

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("target-positions-update", {
            detail: positions,
          })
        );
      }
    }
  });

  return null; // No visual output — purely a data bridge
};
