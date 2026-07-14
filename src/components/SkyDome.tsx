"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { SkyShader } from "@/shaders/skyShader";

export const SkyDome: React.FC = () => {
  const { settings } = useSimulation();
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const gltf = useGLTF("/SCENE.glb");

  // Clone uniforms structure
  const uniforms = useMemo(() => {
    return THREE.UniformsUtils.clone(SkyShader.uniforms);
  }, []);

  // Sync settings reactively to uniforms
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;

    u.uHorizonColor.value.set(settings.skyColor || "#ff007f");
    u.uExposure.value = settings.skyExposure ?? 1.0;
    if (u.uHorizonMin) {
      u.uHorizonMin.value = settings.skyHorizonRange ?? 0.0;
    }
  }, [settings.skyColor, settings.skyExposure, settings.skyHorizonRange]);

  // Compute max animation duration for this scene (based on SCENE.glb camera action)
  const maxDuration = useMemo(() => {
    if (!gltf) return 1;
    let max = 0;
    const activeMixamoActionName = "mixamo.com.003";
    gltf.animations.forEach((clip) => {
      const name = clip.name;
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) return;
      max = Math.max(max, clip.duration);
    });
    return max || 1;
  }, [gltf]);

  const scrollData = useScroll();

  // Centering and rotating Sky Dome with the camera every frame
  useFrame((state) => {
    if (meshRef.current && camera) {
      // Keeps the dome centered on the camera and aligned with its world orientation
      camera.getWorldPosition(meshRef.current.position);
      camera.getWorldQuaternion(meshRef.current.quaternion);
    }
    
    // --- Scroll Burnout and Exposure Calculation ---
    if (materialRef.current && scrollData) {
      const u = materialRef.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;

      // Compute current animation frame based on Scene 0 scroll progress
      const glUserData = (state.gl as any).userData || {};
      const scrollNorms: number[] = glUserData.sceneScrollNorms || [];
      const scrollNorm = scrollNorms[0] ?? 0.0;
      const globalTime = scrollNorm * maxDuration;
      const currentFrame = globalTime * 30;

      // Exposure kept as configured in settings (scroll-based fading disabled)
      u.uExposure.value = settings.skyExposure ?? 1.0;
      
      // Disabled so sky dome doesn't disappear on scroll
      if (u.uBurnOut) u.uBurnOut.value = 0.0;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[800, 32, 15]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={SkyShader.vertexShader}
        fragmentShader={SkyShader.fragmentShader}
        uniforms={uniforms}
        transparent={false}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
};
