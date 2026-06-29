"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { GridFloorShader } from "@/shaders/gridFloorShader";
import { useScroll } from "@react-three/drei";

interface GridFloorProps {
  projectionBounds?: { min: number; max: number };
}

export const GridFloor: React.FC<GridFloorProps> = ({ projectionBounds }) => {
  const { settings } = useSimulation();
  const scrollData = useScroll();
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Initialize shader uniforms once
  const uniforms = useMemo(() => {
    return THREE.UniformsUtils.clone(GridFloorShader.uniforms);
  }, []);

  // Track current animated reveal depth
  const animState = useMemo(
    () => ({
      currentDepth: settings.xrayBorderRevealDepth ?? 40.0,
      currentSolidDepth: settings.xraySolidRevealDepth ?? 200.0,
    }),
    []
  );

  // Sync settings reactively to uniforms
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;

    u.uColor.value.set(settings.xrayBorderColor || "#e91e63");
    u.uOpacity.value = settings.gridFloorOpacity ?? 0.35;
    u.uTileSize.value = settings.gridTileSize ?? 4.0;
    u.uLineWidth.value = settings.gridLineWidth ?? 1.5; // screen-space pixels width
    
    u.uBaseColor.value.set(settings.xrayBaseColor || "#888888");
    u.uFillOpacity.value = 0.0;

    // Sync sweep boundaries
    if (projectionBounds) {
      u.uMinProj.value = projectionBounds.min;
      u.uMaxProj.value = projectionBounds.max;
    }
  }, [
    settings.xrayBorderColor,
    settings.gridFloorOpacity,
    settings.gridTileSize,
    settings.gridLineWidth,
    settings.xrayBaseColor,
    settings.gridFloorFillOpacity,
    projectionBounds,
  ]);

  // Frame loop for time and depth animations
  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;

    // Time uniform for scanlines
    u.uTime.value = state.clock.elapsedTime;

    // Target depths reveal from settings
    const targetDepth = settings.xrayBorderRevealDepth ?? 40.0;
    const targetSolidDepth = settings.xraySolidRevealDepth ?? 200.0;

    // Smooth lerp reveal depths (matching the 0.2s delay of borders)
    const lerpSpeed = 1.0 - Math.exp(-delta / 0.2);
    animState.currentDepth += (targetDepth - animState.currentDepth) * lerpSpeed;
    animState.currentSolidDepth += (targetSolidDepth - animState.currentSolidDepth) * lerpSpeed;
    
    if (u.uDepthLimit) u.uDepthLimit.value = animState.currentDepth;
    if (u.uSolidDepthLimit) u.uSolidDepthLimit.value = animState.currentSolidDepth;
    
    // --- Scroll Burnout Calculation ---
    // Disabled so grid floor doesn't disappear on scroll
    const burnOut = 0.0;
    if (u.uBurnOut) u.uBurnOut.value = burnOut;

    // Floor opacity remains fully dependent on settings.gridFloorOpacity;
    // depth limits in the shader handle localized fade-out around the camera.
    u.uOpacity.value = settings.gridFloorOpacity ?? 0.35;
  });

  return (
    <mesh
      position={[0, settings.gridFloorY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[1000, 1000]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={GridFloorShader.vertexShader}
        fragmentShader={GridFloorShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
