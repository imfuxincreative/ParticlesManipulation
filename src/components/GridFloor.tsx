"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { GridFloorShader } from "@/shaders/gridFloorShader";

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
    () => ({ currentDepth: settings.xrayBorderRevealDepth ?? 40.0 }),
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

    // Target depth reveal from settings (synced with city borders)
    const targetDepth = settings.xrayBorderRevealDepth ?? 40.0;

    // Smooth lerp reveal depth (matching the 0.2s delay of borders)
    const lerpSpeed = 1.0 - Math.exp(-delta / 0.2);
    animState.currentDepth += (targetDepth - animState.currentDepth) * lerpSpeed;
    if (u.uDepthLimit) u.uDepthLimit.value = animState.currentDepth;
    
    // --- Scroll Burnout Calculation ---
    let burnOut = 0.0;
    if (scrollData) {
      const t = scrollData.offset;
      // Trigger burnout from 0.0 to 0.5 scroll progress
      burnOut = Math.min(1.0, Math.max(0.0, t / 0.5));
    }
    if (u.uBurnOut) u.uBurnOut.value = burnOut;

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
