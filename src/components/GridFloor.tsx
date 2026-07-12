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
    u.uGlowIntensity.value = settings.xrayLineGlowIntensity ?? 2.5;
    u.uOpacity.value = settings.gridFloorOpacity ?? 0.35;
    u.uTileSize.value = settings.gridTileSize ?? 4.0;
    u.uLineWidth.value = settings.gridLineWidth ?? 1.5; // screen-space pixels width
    
    u.uBaseColor.value.set(settings.xrayBaseColor || "#888888");
    u.uFillOpacity.value = settings.gridFloorFillOpacity ?? 0.15;

    // Sync fog settings
    if (u.uShowFog) u.uShowFog.value = settings.showFog ? 1.0 : 0.0;
    if (u.uFogColor) u.uFogColor.value.set(settings.fogColor);
    if (u.uFogNear) u.uFogNear.value = settings.fogNear;
    if (u.uFogFar) u.uFogFar.value = settings.fogFar;
    if (u.uFogAmount) u.uFogAmount.value = settings.fogAmount;

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

    // Apply scroll overrides and fog overrides in the frame loop
    const glUserData = (state.gl as any).userData || {};
    const vis = glUserData.sceneVisuals || {};

    const borderGlowColor = vis.xrayBorderColor ?? settings.xrayBorderColor;
    const baseFillColor = vis.xrayBaseColor ?? settings.xrayBaseColor;
    const lineOpacity = vis.gridFloorOpacity ?? settings.gridFloorOpacity ?? 0.35;

    u.uColor.value.set(borderGlowColor || "#e91e63");
    u.uBaseColor.value.set(baseFillColor || "#888888");
    u.uOpacity.value = lineOpacity;

    const showFogVal = vis.showFog !== undefined ? vis.showFog : settings.showFog;
    const fogColorVal = vis.fogColor ?? settings.fogColor;
    const fogNearVal = vis.fogNear !== undefined ? vis.fogNear : settings.fogNear;
    const fogFarVal = vis.fogFar !== undefined ? vis.fogFar : settings.fogFar;
    const fogAmountVal = vis.fogAmount !== undefined ? vis.fogAmount : settings.fogAmount;

    if (u.uShowFog) u.uShowFog.value = showFogVal ? 1.0 : 0.0;
    if (u.uFogColor) u.uFogColor.value.set(fogColorVal);
    if (u.uFogNear) u.uFogNear.value = fogNearVal;
    if (u.uFogFar) u.uFogFar.value = fogFarVal;
    if (u.uFogAmount) u.uFogAmount.value = fogAmountVal;
  });

  return (
    <mesh
      position={[0, settings.gridFloorY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[2000, 2000]} />
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
