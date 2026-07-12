"use client";

import React, { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { CityXRayShader } from "@/shaders/cityXRayShader";
import { CityXRayLineShader } from "@/shaders/cityXRayLineShader";
import { useScroll } from "@react-three/drei";

interface CityXRayMeshSystemProps {
  meshes: THREE.Mesh[];
  projectionBounds?: { min: number; max: number };
  sceneIndex: number;
}

/**
 * CityXRayMeshSystem
 *
 * Replaces the original materials of the city meshes with a custom
 * holographic architectural X-Ray shader. This preserves the original
 * hierarchy, transforms, and animations from the GLTF scene.
 */
export const CityXRayMeshSystem: React.FC<CityXRayMeshSystemProps> = ({ meshes, projectionBounds, sceneIndex }) => {
  const { settings } = useSimulation();
  const scrollData = useScroll();

  // Create the shared X-Ray material
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: CityXRayShader.vertexShader,
      fragmentShader: CityXRayShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(CityXRayShader.uniforms),
      transparent: true,
      depthWrite: false, // Don't write to depth buffer to allow x-ray see-through for general city meshes
      blending: THREE.NormalBlending, // Normal blending looks best for solid x-ray
      side: THREE.DoubleSide, // Show inside of rooms too
    });
    return mat;
  }, []);

  // Create the shared Line Shader Material for depth-faded borders
  const lineMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: CityXRayLineShader.vertexShader,
      fragmentShader: CityXRayLineShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(CityXRayLineShader.uniforms),
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Skinned variants — same shaders, but with USE_SKINNING define for SkinnedMesh.
  // They share uniform *references* with the base materials so updates sync automatically.
  const skinnedMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: CityXRayShader.vertexShader,
      fragmentShader: CityXRayShader.fragmentShader,
      uniforms: material.uniforms, // share same uniform objects
      defines: { USE_SKINNING: '' },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    return mat;
  }, [material]);



  const skinnedLineMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: CityXRayLineShader.vertexShader,
      fragmentShader: CityXRayLineShader.fragmentShader,
      uniforms: lineMaterial.uniforms, // share same uniform objects
      defines: { USE_SKINNING: '' },
      transparent: true,
      depthWrite: false,
    });
  }, [lineMaterial]);

  // Track the current animated depth value (used for smooth lerping)
  const animState = useMemo(() => ({
    currentDepth: settings.xrayBorderRevealDepth ?? 40.0,
    currentSolidDepth: settings.xraySolidRevealDepth ?? 200.0,
  }), []);

  // Sync settings to uniforms and line material
  useEffect(() => {
    // If there's an opacity setting in the simulation context, use it, otherwise default to 1.0
    material.uniforms.uOpacity.value = settings.opacity !== undefined ? settings.opacity : 1.0;

    // Sync new settings
    material.uniforms.uFillOpacity.value = settings.xrayFillOpacity;
    material.uniforms.uScanLineIntensity.value = settings.xrayScanlineIntensity;
    material.uniforms.uFresnelPower.value = settings.xrayOutlinePower;

    // Update colors
    material.uniforms.uColor.value.set(settings.xrayBaseColor);
    material.uniforms.uGlowColor.value.set(settings.xrayOutlineColor);
    if (material.uniforms.uHazeColor) {
      material.uniforms.uHazeColor.value.set(settings.hazeColor);
    }

    // Update border color, opacity, and glow intensity
    lineMaterial.uniforms.uColor.value.set(settings.xrayBorderColor || "#e91e63");
    lineMaterial.uniforms.uOpacity.value = settings.xrayBorderOpacity ?? 0.5;
    lineMaterial.uniforms.uGlowIntensity.value = settings.xrayLineGlowIntensity ?? 2.5;

    // Sync fog settings
    if (material.uniforms.uShowFog) material.uniforms.uShowFog.value = settings.showFog ? 1.0 : 0.0;
    if (material.uniforms.uFogColor) material.uniforms.uFogColor.value.set(settings.fogColor);
    if (material.uniforms.uFogNear) material.uniforms.uFogNear.value = settings.fogNear;
    if (material.uniforms.uFogFar) material.uniforms.uFogFar.value = settings.fogFar;
    if (material.uniforms.uFogAmount) material.uniforms.uFogAmount.value = settings.fogAmount;

    if (lineMaterial.uniforms.uShowFog) lineMaterial.uniforms.uShowFog.value = settings.showFog ? 1.0 : 0.0;
    if (lineMaterial.uniforms.uFogColor) lineMaterial.uniforms.uFogColor.value.set(settings.fogColor);
    if (lineMaterial.uniforms.uFogNear) lineMaterial.uniforms.uFogNear.value = settings.fogNear;
    if (lineMaterial.uniforms.uFogFar) lineMaterial.uniforms.uFogFar.value = settings.fogFar;
    if (lineMaterial.uniforms.uFogAmount) lineMaterial.uniforms.uFogAmount.value = settings.fogAmount;

    // We can also tie scanline speed to noiseSpeed if we want it to react to global controls
    if (settings.noiseSpeed !== undefined) {
      material.uniforms.uScanLineSpeed.value = settings.noiseSpeed * 2.0;
    }

    // Hover Settings
    material.uniforms.uHoverColor.value.set(settings.xrayBorderColor || "#e91e63");
    material.uniforms.uHoverRadius.value = settings.xrayHoverRadius ?? 10.0;

    // Sync sweep boundaries
    if (projectionBounds) {
      material.uniforms.uMinProj.value = projectionBounds.min;
      material.uniforms.uMaxProj.value = projectionBounds.max;
      lineMaterial.uniforms.uMinProj.value = projectionBounds.min;
      lineMaterial.uniforms.uMaxProj.value = projectionBounds.max;
    }
  }, [settings, material, lineMaterial, projectionBounds]);

  // Apply the material to the original meshes and add edge lines
  useEffect(() => {
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const edgeLines: THREE.Object3D[] = [];

    meshes.forEach((mesh) => {
      if (!mesh) return;
      originalMaterials.set(mesh, mesh.material);

      // Use skinned variant for SkinnedMesh, base for regular Mesh
      const isSkinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh;
      mesh.material = isSkinned ? skinnedMaterial : material;
      mesh.visible = true; // Override the visible=false set in SceneModel
      mesh.frustumCulled = false; // Disable frustum culling to prevent disappearing when close

      let line: THREE.Object3D;

      if (isSkinned) {
        const skinnedMesh = mesh as THREE.SkinnedMesh;
        const edgesGeo = new THREE.EdgesGeometry(skinnedMesh.geometry, settings.xrayBorderThreshold ?? 15);

        // Copy skinIndex and skinWeight attributes
        const origPos = skinnedMesh.geometry.attributes.position;
        const origIndex = skinnedMesh.geometry.attributes.skinIndex;
        const origWeight = skinnedMesh.geometry.attributes.skinWeight;

        if (origPos && origIndex && origWeight) {
          const posMap = new Map<string, number>();
          for (let i = 0; i < origPos.count; i++) {
            const x = origPos.getX(i);
            const y = origPos.getY(i);
            const z = origPos.getZ(i);
            const key = `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`;
            posMap.set(key, i);
          }

          const edgesPos = edgesGeo.attributes.position;
          const skinIndexArr = new Float32Array(edgesPos.count * 4);
          const skinWeightArr = new Float32Array(edgesPos.count * 4);

          for (let i = 0; i < edgesPos.count; i++) {
            const x = edgesPos.getX(i);
            const y = edgesPos.getY(i);
            const z = edgesPos.getZ(i);
            const key = `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`;
            const origIdx = posMap.get(key) ?? 0;

            skinIndexArr[i * 4] = origIndex.getX(origIdx);
            skinIndexArr[i * 4 + 1] = origIndex.getY(origIdx);
            skinIndexArr[i * 4 + 2] = origIndex.getZ(origIdx);
            skinIndexArr[i * 4 + 3] = origIndex.getW(origIdx);

            skinWeightArr[i * 4] = origWeight.getX(origIdx);
            skinWeightArr[i * 4 + 1] = origWeight.getY(origIdx);
            skinWeightArr[i * 4 + 2] = origWeight.getZ(origIdx);
            skinWeightArr[i * 4 + 3] = origWeight.getW(origIdx);
          }

          edgesGeo.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndexArr, 4));
          edgesGeo.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeightArr, 4));
        }

        const skinnedLine = new THREE.SkinnedMesh(edgesGeo, skinnedLineMaterial);
        // Bind to the parent mesh's skeleton
        if (skinnedMesh.skeleton) {
          skinnedLine.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);
        }

        // Hack properties to render as LineSegments
        (skinnedLine as any).isMesh = false;
        (skinnedLine as any).isLine = true;
        (skinnedLine as any).isLineSegments = true;
        skinnedLine.frustumCulled = false; // Disable frustum culling on line

        line = skinnedLine;
      } else {
        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, settings.xrayBorderThreshold ?? 15);
        line = new THREE.LineSegments(edgesGeo, lineMaterial);
        line.frustumCulled = false; // Disable frustum culling on line
      }

      mesh.add(line);
      edgeLines.push(line);
    });

    return () => {
      // Restore on unmount
      meshes.forEach((mesh, index) => {
        if (!mesh) return;
        if (originalMaterials.has(mesh)) {
          mesh.material = originalMaterials.get(mesh)!;
        }
        mesh.visible = false;

        // Remove and cleanup edges
        const line = edgeLines[index];
        if (line) {
          mesh.remove(line);
          if ((line as any).geometry) {
            (line as any).geometry.dispose();
          }
        }
      });
    };
  }, [
    meshes,
    material,
    lineMaterial,
    skinnedMaterial,
    skinnedLineMaterial,
    settings.xrayBorderThreshold
  ]);

  // Animate: update time + smoothly lerp depth reveal with 0.2s delay
  useFrame((state, delta) => {
    // Retrieve global glitch and transition variables from shared renderer state
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // A scene system is active only if it is the active scene OR the incoming transitioning scene
    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);
    if (!isVisible) return; // Skip updating uniforms, raycasts, and clocks if hidden

    material.uniforms.uTime.value = state.clock.elapsedTime;
    const bgGlitchActive = glUserData.bgGlitchActive ?? 0.0;
    const bgGlitchSeed = glUserData.bgGlitchSeed ?? 0.0;
    const transitionProgress = glUserData.transitionProgress ?? 0.0;

    // Read per-scene visual overrides (cross-faded by orchestrator)
    const vis = glUserData.sceneVisuals || {};

    material.uniforms.uGlitchActive.value = bgGlitchActive;
    material.uniforms.uGlitchSeed.value = bgGlitchSeed;
    material.uniforms.uTransitionProgress.value = transitionProgress;
    material.uniforms.uSceneIndex.value = sceneIndex;
    material.uniforms.uActiveSceneIndex.value = activeSceneIndex;

    lineMaterial.uniforms.uGlitchActive.value = bgGlitchActive;
    lineMaterial.uniforms.uGlitchSeed.value = bgGlitchSeed;
    lineMaterial.uniforms.uTransitionProgress.value = transitionProgress;
    lineMaterial.uniforms.uSceneIndex.value = sceneIndex;
    lineMaterial.uniforms.uActiveSceneIndex.value = activeSceneIndex;

    // Apply visual overrides (falling back to global settings)
    material.uniforms.uColor.value.set(vis.xrayBaseColor ?? settings.xrayBaseColor);
    material.uniforms.uGlowColor.value.set(vis.xrayOutlineColor ?? settings.xrayOutlineColor);
    material.uniforms.uFillOpacity.value = vis.xrayFillOpacity ?? settings.xrayFillOpacity;
    material.uniforms.uFresnelPower.value = vis.xrayOutlinePower ?? settings.xrayOutlinePower;
    material.uniforms.uScanLineIntensity.value = vis.xrayScanlineIntensity ?? settings.xrayScanlineIntensity;
    material.uniforms.uHoverRadius.value = vis.xrayHoverRadius ?? settings.xrayHoverRadius;
    if (material.uniforms.uHazeColor) {
      material.uniforms.uHazeColor.value.set(vis.hazeColor ?? settings.hazeColor);
    }

    lineMaterial.uniforms.uColor.value.set(vis.xrayBorderColor ?? settings.xrayBorderColor);
    lineMaterial.uniforms.uOpacity.value = vis.xrayBorderOpacity ?? settings.xrayBorderOpacity;

    // Apply fog overrides (falling back to global settings)
    const showFogVal = vis.showFog !== undefined ? vis.showFog : settings.showFog;
    const fogColorVal = vis.fogColor ?? settings.fogColor;
    const fogNearVal = vis.fogNear !== undefined ? vis.fogNear : settings.fogNear;
    const fogFarVal = vis.fogFar !== undefined ? vis.fogFar : settings.fogFar;
    const fogAmountVal = vis.fogAmount !== undefined ? vis.fogAmount : settings.fogAmount;

    material.uniforms.uShowFog.value = showFogVal ? 1.0 : 0.0;
    material.uniforms.uFogColor.value.set(fogColorVal);
    material.uniforms.uFogNear.value = fogNearVal;
    material.uniforms.uFogFar.value = fogFarVal;
    material.uniforms.uFogAmount.value = fogAmountVal;

    lineMaterial.uniforms.uShowFog.value = showFogVal ? 1.0 : 0.0;
    lineMaterial.uniforms.uFogColor.value.set(fogColorVal);
    lineMaterial.uniforms.uFogNear.value = fogNearVal;
    lineMaterial.uniforms.uFogFar.value = fogFarVal;
    lineMaterial.uniforms.uFogAmount.value = fogAmountVal;

    // Target depth from visual overrides or settings
    const targetDepth = vis.xrayBorderRevealDepth ?? settings.xrayBorderRevealDepth ?? 40.0;
    const targetSolidDepth = vis.xraySolidRevealDepth ?? settings.xraySolidRevealDepth ?? 200.0;

    // Smooth lerp towards target with ~0.2s delay
    const lerpSpeed = 1.0 - Math.exp(-delta / 0.2);
    animState.currentDepth += (targetDepth - animState.currentDepth) * lerpSpeed;
    animState.currentSolidDepth += (targetSolidDepth - animState.currentSolidDepth) * lerpSpeed;

    // Push animated values to the shaders
    lineMaterial.uniforms.uDepthLimit.value = animState.currentDepth;
    material.uniforms.uDepthLimit.value = animState.currentSolidDepth;

    // --- Interactive Hover Raycasting ---
    state.raycaster.setFromCamera(state.pointer, state.camera);

    // Intersect all valid city meshes
    const validMeshes = meshes.filter((mesh) => mesh && mesh.matrixWorld);
    const hits = state.raycaster.intersectObjects(validMeshes, false);

    if (hits.length > 0 && hits[0].point) {
      material.uniforms.uMouseWorld.value.copy(hits[0].point);
      material.uniforms.uHoverActive.value = 1.0;
    } else {
      material.uniforms.uHoverActive.value = 0.0;
    }
    
    // --- Scroll Burnout Calculation ---
    const burnOut = 0.0;
    material.uniforms.uBurnOut.value = burnOut;
    lineMaterial.uniforms.uBurnOut.value = burnOut;
    lineMaterial.uniforms.uTime.value = state.clock.elapsedTime;

    // --- Scroll-driven vertical clipping disabled (Single scene mode) ---
    const clipSide = 0.0;
    const clipY = -15.0;

    material.uniforms.uClipY.value = clipY;
    material.uniforms.uClipSide.value = clipSide;
    lineMaterial.uniforms.uClipY.value = clipY;
    lineMaterial.uniforms.uClipSide.value = clipSide;
  });

  return null;
};
