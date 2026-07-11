"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { SkyShader } from "@/shaders/skyShader";

export const SkyDome: React.FC = () => {
  const { settings } = useSimulation();
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

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

  // Centering Sky Dome on the camera every frame
  useFrame((state) => {
    if (meshRef.current && camera) {
      // Keeps the dome centered on the camera so the camera never leaves it
      meshRef.current.position.copy(camera.position);
    }
    
    // --- Scroll Burnout Calculation ---
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      
      // Disabled so sky dome doesn't disappear on scroll
      const burnOut = 0.0;
      if (u.uBurnOut) u.uBurnOut.value = burnOut;
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
