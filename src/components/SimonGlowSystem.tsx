"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SimonGlowShader } from "@/shaders/simonGlowShader";
import { useSimulation } from "@/context/SimulationContext";

interface SimonGlowSystemProps {
  meshes: THREE.Mesh[];
  sceneIndex: number;
}

export const SimonGlowSystem: React.FC<SimonGlowSystemProps> = ({ meshes, sceneIndex }) => {
  const { settings } = useSimulation();
  
  // Track cloned materials active on meshes to update them in the frame loop
  const activeMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);

  // Base shader material (FrontSide rendering eliminates double-layered transparent overlap)
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SimonGlowShader.vertexShader,
      fragmentShader: SimonGlowShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(SimonGlowShader.uniforms),
      transparent: true,
      depthWrite: true, // Need depth writing for proper occlusion
    });
  }, []);

  // Skinned shader material variant sharing same uniforms
  const skinnedMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SimonGlowShader.vertexShader,
      fragmentShader: SimonGlowShader.fragmentShader,
      uniforms: material.uniforms,
      defines: { USE_SKINNING: '' },
      transparent: true,
      depthWrite: true,
    });
  }, [material]);

  // Sync settings to uniforms
  useEffect(() => {
    const mats = [material, skinnedMaterial, ...activeMaterialsRef.current];
    mats.forEach((mat) => {
      mat.uniforms.uGlowIntensity.value = settings.simonGlowIntensity;
      if (mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = settings.simonGlowOpacity;
      if (settings.simonGlowColor) {
        mat.uniforms.uColor.value.set(settings.simonGlowColor);
      }
      
      // Sync fog uniforms
      if (mat.uniforms.uShowFog) mat.uniforms.uShowFog.value = settings.showFog ? 1.0 : 0.0;
      if (mat.uniforms.uFogColor) mat.uniforms.uFogColor.value.set(settings.fogColor);
      if (mat.uniforms.uFogNear) mat.uniforms.uFogNear.value = settings.fogNear;
      if (mat.uniforms.uFogFar) mat.uniforms.uFogFar.value = settings.fogFar;
      if (mat.uniforms.uFogAmount) mat.uniforms.uFogAmount.value = settings.fogAmount;
    });
  }, [settings.simonGlowIntensity, settings.simonGlowOpacity, settings.simonGlowColor, settings.showFog, settings.fogColor, settings.fogNear, settings.fogFar, settings.fogAmount, material, skinnedMaterial, meshes]);

  // Replace meshes' materials and restore on unmount (deferred by 1 frame to prevent loader freeze)
  useEffect(() => {
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const clonedMaterials: THREE.ShaderMaterial[] = [];

    const rafId = requestAnimationFrame(() => {
      meshes.forEach((mesh) => {
        if (!mesh) return;
        originalMaterials.set(mesh, mesh.material);

        const isSkinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh;
        const baseMat = isSkinned ? skinnedMaterial : material;
        const clonedMat = baseMat.clone();

        // Compute bounding box for edge gradients
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        if (bbox) {
          clonedMat.uniforms.uLocalMin = { value: bbox.min.clone() };
          clonedMat.uniforms.uLocalMax = { value: bbox.max.clone() };
        }

        const isHair = mesh.name.toLowerCase().includes("hair");
        clonedMat.uniforms.uIsHair = { value: isHair ? 1.0 : 0.0 };

        mesh.material = clonedMat;
        mesh.visible = true;
        mesh.frustumCulled = false;

        clonedMaterials.push(clonedMat);
      });

      activeMaterialsRef.current = clonedMaterials;
    });

    return () => {
      cancelAnimationFrame(rafId);
      meshes.forEach((mesh) => {
        if (!mesh) return;
        if (originalMaterials.has(mesh)) {
          mesh.material = originalMaterials.get(mesh)!;
        }
      });
      activeMaterialsRef.current = [];
    };
  }, [meshes, material, skinnedMaterial]);

  useFrame((state) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // Update only if this scene is visible
    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);
    if (!isVisible) return;

    // Apply real-time scroll overrides for fog
    const vis = glUserData.sceneVisuals || {};
    const showFogVal = vis.showFog !== undefined ? vis.showFog : settings.showFog;
    const fogColorVal = vis.fogColor ?? settings.fogColor;
    const fogNearVal = vis.fogNear !== undefined ? vis.fogNear : settings.fogNear;
    const fogFarVal = vis.fogFar !== undefined ? vis.fogFar : settings.fogFar;
    const fogAmountVal = vis.fogAmount !== undefined ? vis.fogAmount : settings.fogAmount;

    const mats = [material, skinnedMaterial, ...activeMaterialsRef.current];
    mats.forEach((mat) => {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      
      if (mat.uniforms.uShowFog) mat.uniforms.uShowFog.value = showFogVal ? 1.0 : 0.0;
      if (mat.uniforms.uFogColor) mat.uniforms.uFogColor.value.set(fogColorVal);
      if (mat.uniforms.uFogNear) mat.uniforms.uFogNear.value = fogNearVal;
      if (mat.uniforms.uFogFar) mat.uniforms.uFogFar.value = fogFarVal;
      if (mat.uniforms.uFogAmount) mat.uniforms.uFogAmount.value = fogAmountVal;
      
      if (mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = settings.simonGlowOpacity;
      mat.uniforms.uGlowIntensity.value = settings.simonGlowIntensity;
      if (settings.simonGlowColor) {
        mat.uniforms.uColor.value.set(settings.simonGlowColor);
      }
    });
  });

  return null;
};
