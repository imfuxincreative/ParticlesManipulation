"use client";

import React, { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { GridFloorShader } from "@/shaders/gridFloorShader";

interface GridFloorMeshSystemProps {
  meshes: THREE.Mesh[];
  projectionBounds?: { min: number; max: number };
  sceneIndex: number;
}

// Custom Grid Floor Shader optimized for GLTF meshes that might be rotated
const CustomGridFloorShader = {
  vertexShader: `
    varying vec2 vPlaneCoords;
    varying vec3 vWorldPosition;
    varying float vDepth;
    
    void main() {
      // Calculate world position
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      // Calculate view-space depth
      vec4 mvPosition = viewMatrix * worldPosition;
      vDepth = -mvPosition.z;
      
      // Calculate world scale of the mesh from the columns of the modelMatrix
      float scaleX = length(vec3(modelMatrix[0][0], modelMatrix[0][1], modelMatrix[0][2]));
      float scaleZ = length(vec3(modelMatrix[2][0], modelMatrix[2][1], modelMatrix[2][2]));
      
      // Project local X and Z coordinates onto plane coords scaled to world units
      vPlaneCoords = vec2(position.x * scaleX, position.z * scaleZ);
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uGlowIntensity;
    uniform float uOpacity;
    uniform float uDepthLimit;
    uniform float uFadeZone;
    uniform float uTileSize;
    uniform float uLineWidth;
    
    uniform vec3 uBaseColor;
    
    uniform float uShowFog;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uFogAmount;
    uniform float uFillOpacity;
    uniform float uBurnOut;
    uniform float uSolidDepthLimit;
    uniform vec3 uWipeDirection;
    uniform float uMinProj;
    uniform float uMaxProj;
    
    varying vec2 vPlaneCoords;
    varying vec3 vWorldPosition;
    varying float vDepth;
    
    void main() {
      // Calculate side-sweeping wipe progress in world space
      float proj = dot(vWorldPosition.xyz, uWipeDirection);
      float progress = clamp((proj - uMinProj) / (uMaxProj - uMinProj), 0.0, 1.0);
      
      // Smooth opacity transition zone
      float transitionWidth = 0.1;
      float wipeProgress = uBurnOut * 1.25 - 0.1;
      float alphaFactor = smoothstep(wipeProgress, wipeProgress + transitionWidth, progress);

      // 1. Calculate Grid Lines (using local plane coordinates scaled to world units)
      vec2 localCoord = abs(fract(vPlaneCoords / uTileSize - 0.5) - 0.5) * uTileSize;
      vec2 gridDeriv = fwidth(vPlaneCoords);
      vec2 thickness = max(vec2(0.04), uLineWidth * gridDeriv);
      vec2 lineVal = 1.0 - smoothstep(vec2(0.0), thickness, localCoord);
      float lineStrength = max(lineVal.x, lineVal.y);
      
      // 2. Add a soft grid cell/tiled fill pattern (chessboard)
      vec2 tileIndex = floor(vPlaneCoords / uTileSize);
      float tileCheck = mod(abs(tileIndex.x + tileIndex.y), 2.0);
      bool isOdd = tileCheck < 0.5;
      float cellFill = isOdd ? uFillOpacity : 0.0;
      
      // 3. X-Ray Reveal (Depth-based) - ONLY applies to grid lines
      float fadeStart = max(0.0, uDepthLimit - uFadeZone);
      float xrayAlpha = 1.0 - smoothstep(fadeStart, uDepthLimit, vDepth);
      float lineAlpha = lineStrength * xrayAlpha * uOpacity;
      
      // Chessboard tiles are always visible
      float tileAlpha = cellFill * (1.0 - lineStrength);
      
      vec3 baseGridColor = mix(uBaseColor, uColor * uGlowIntensity, lineStrength);
      float baseGridAlpha = max(lineAlpha, tileAlpha);
      
      // Scanline aligned with local plane rows (y direction of vPlaneCoords)
      float scanline = sin(vPlaneCoords.y * 2.0 - uTime * 3.0) * 0.5 + 0.5;
      baseGridColor = mix(baseGridColor, baseGridColor * 1.3, scanline * lineStrength * 0.3);
      
      float finalAlpha = baseGridAlpha * alphaFactor;
      
      // Apply environmental fog
      float fogFactor = clamp((uFogFar - vDepth) / max(uFogFar - uFogNear, 0.0001), 0.0, 1.0);
      float fogMix = uShowFog * uFogAmount * (1.0 - fogFactor);
      baseGridColor = mix(baseGridColor, uFogColor, fogMix);
      finalAlpha = mix(finalAlpha, 0.0, fogMix);

      if (finalAlpha < 0.001) discard;
      
      gl_FragColor = vec4(baseGridColor, finalAlpha);
    }
  `
};

export const GridFloorMeshSystem: React.FC<GridFloorMeshSystemProps> = ({
  meshes,
  projectionBounds,
  sceneIndex,
}) => {
  const { settings } = useSimulation();

  // Create the shared custom Grid Floor shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: CustomGridFloorShader.vertexShader,
      fragmentShader: CustomGridFloorShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(GridFloorShader.uniforms),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  // Track the current animated depth value
  const animState = useMemo(
    () => ({
      currentDepth: settings.xrayBorderRevealDepth ?? 40.0,
      currentSolidDepth: settings.xraySolidRevealDepth ?? 200.0,
    }),
    []
  );

  // Sync settings reactively to uniforms
  useEffect(() => {
    const u = material.uniforms;

    u.uColor.value.set(settings.xrayBorderColor || "#e91e63");
    u.uGlowIntensity.value = settings.xrayLineGlowIntensity ?? 2.5;
    u.uOpacity.value = settings.gridFloorOpacity ?? 0.35;
    u.uTileSize.value = settings.gridTileSize ?? 4.0;
    u.uLineWidth.value = settings.gridLineWidth ?? 1.5;
    
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
    settings.xrayLineGlowIntensity,
    settings.gridFloorOpacity,
    settings.gridTileSize,
    settings.gridLineWidth,
    settings.xrayBaseColor,
    settings.gridFloorFillOpacity,
    settings.showFog,
    settings.fogColor,
    settings.fogNear,
    settings.fogFar,
    settings.fogAmount,
    projectionBounds,
    material,
  ]);

  // Apply material and manage mesh visibility
  useEffect(() => {
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

    meshes.forEach((mesh) => {
      if (!mesh) return;
      originalMaterials.set(mesh, mesh.material);

      mesh.material = material;
      mesh.visible = true; // Ensure the mesh is active when this system is mounted
      mesh.frustumCulled = false;
    });

    return () => {
      // Restore on unmount
      meshes.forEach((mesh) => {
        if (!mesh) return;
        if (originalMaterials.has(mesh)) {
          mesh.material = originalMaterials.get(mesh)!;
        }
        mesh.visible = false;
      });
    };
  }, [meshes, material]);

  // Update animated uniforms in frame loop
  useFrame((state, delta) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // Active only if it's the active scene or the incoming transition scene
    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);
    if (!isVisible) return;

    const u = material.uniforms;

    // Time uniform
    u.uTime.value = state.clock.elapsedTime;

    // Target depths reveal
    const targetDepth = settings.xrayBorderRevealDepth ?? 40.0;
    const targetSolidDepth = settings.xraySolidRevealDepth ?? 200.0;

    // Smooth lerp reveal depths
    const lerpSpeed = 1.0 - Math.exp(-delta / 0.2);
    animState.currentDepth += (targetDepth - animState.currentDepth) * lerpSpeed;
    animState.currentSolidDepth += (targetSolidDepth - animState.currentSolidDepth) * lerpSpeed;
    
    if (u.uDepthLimit) u.uDepthLimit.value = animState.currentDepth;
    if (u.uSolidDepthLimit) u.uSolidDepthLimit.value = animState.currentSolidDepth;
    
    // Scroll Burnout
    const burnOut = 0.0;
    if (u.uBurnOut) u.uBurnOut.value = burnOut;

    // Apply scroll overrides and fog overrides in the frame loop
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

  return null;
};
