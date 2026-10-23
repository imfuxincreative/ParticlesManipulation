"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { InTouchModel } from "./InTouchModel";
import { useAtmosphere } from "@/lib/atmosphere";
import { useLoopTransition } from "@/components/transitions/transitionConfig";
import { brokenLightEngine } from "@/lib/brokenLightFlicker";

export const InTouchScene: React.FC = () => {
  const { set, size, pointer } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const backDirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const backPointLightRef = useRef<THREE.PointLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const horizonColor = useAtmosphere((s) => s.horizonColor);
  const glowColor = useAtmosphere((s) => s.glowColor);
  const activeScene = useLoopTransition((s) => s.activeScene);

  // Parallax target and current smooth vectors
  const parallaxOffset = useRef(new THREE.Vector2(0, 0));
  // Dynamic base position, rotation and FOV read directly from the Blender GLB
  const baseCamPos = useRef<THREE.Vector3 | null>(null);
  const baseCamRot = useRef<THREE.Quaternion | null>(null);
  const baseFov = useRef<number | null>(null);

  // Immediate callback ref to capture camera instance directly from InTouchModel (exported from Blender)
  const handleCameraReady = useCallback(
    (cam: THREE.PerspectiveCamera | null) => {
      cameraRef.current = cam;
      if (cam) {
        // Read exact camera transforms from the Blender export
        baseCamPos.current = cam.position.clone();
        baseCamRot.current = cam.quaternion.clone();
        baseFov.current = cam.fov;

        cam.aspect = size.width / size.height;
        cam.updateProjectionMatrix();

        if (useLoopTransition.getState().activeScene === "inTouch") {
          set({ camera: cam });
        }
      }
    },
    [set, size.width, size.height]
  );

  // Activate this camera whenever activeScene switches to inTouch
  useEffect(() => {
    if (cameraRef.current && activeScene === "inTouch") {
      set({ camera: cameraRef.current });
      cameraRef.current.aspect = size.width / size.height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [set, activeScene, size.width, size.height]);

  // Per-frame camera update and GUARANTEED camera takeover in R3F
  useFrame((state, delta) => {
    if (!cameraRef.current || activeScene !== "inTouch") return;
    const cam = cameraRef.current;

    // Critical: Ensure R3F actively renders through this camera instead of Canvas/SceneModel camera
    if (state.camera !== cam) {
      set({ camera: cam });
    }

    // Maintain aspect ratio from viewport
    const aspect = size.width / size.height;
    if (Math.abs(cam.aspect - aspect) > 0.005) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }

    // Apply subtle mouse parallax around the base camera position from Blender
    if (baseCamPos.current && baseCamRot.current) {
      const targetX = pointer.x * 0.08;
      const targetY = pointer.y * 0.05;
      parallaxOffset.current.x = THREE.MathUtils.damp(parallaxOffset.current.x, targetX, 3.5, delta);
      parallaxOffset.current.y = THREE.MathUtils.damp(parallaxOffset.current.y, targetY, 3.5, delta);

      cam.position.copy(baseCamPos.current);
      cam.position.x += parallaxOffset.current.x;
      cam.position.y += parallaxOffset.current.y;
      cam.quaternion.copy(baseCamRot.current);
      cam.updateMatrixWorld();
    }

    // Synchronize red backlights and rim lighting with physical broken light flicker
    const flicker = brokenLightEngine.getMultiplier();
    if (backDirLightRef.current) {
      backDirLightRef.current.intensity = 9.0 * flicker;
    }
    if (backPointLightRef.current) {
      backPointLightRef.current.intensity = 15.0 * flicker;
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = 0.25 * flicker;
    }
  });

  return (
    <group name="InTouchSceneRoot" visible={activeScene === "inTouch"}>
      {/* Atmospheric Backlight casting character into dramatic red rim silhouette */}
      <directionalLight
        ref={backDirLightRef}
        position={[0, 6.5, -6.5]}
        intensity={9.0}
        color={horizonColor || "#FF000D"}
      />
      <pointLight
        ref={backPointLightRef}
        position={[0, 5.0, -3.5]}
        intensity={15.0}
        distance={30}
        color={glowColor || "#FF1A1A"}
      />
      <ambientLight
        ref={ambientLightRef}
        intensity={0.25}
        color={horizonColor || "#FF000D"}
      />

      {/* Front Key Light to reveal hands reaching forward and 3D surface depth like Blender */}
      <directionalLight
        position={[-1.8, 6.2, 12.0]}
        intensity={2.8}
        color="#ffe2e5"
      />

      {/* 3D Character Model with its own Camera dynamically loaded from inTouch.glb */}
      <InTouchModel cameraRef={handleCameraReady} />
    </group>
  );
};
