"use client";

import React, { useMemo, useEffect } from "react";
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
  // Base shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SimonGlowShader.vertexShader,
      fragmentShader: SimonGlowShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(SimonGlowShader.uniforms),
      transparent: false,
      depthWrite: true, // Need depth writing for proper occlusion
      side: THREE.DoubleSide,
    });
  }, []);

  // Skinned shader material variant sharing same uniforms
  const skinnedMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SimonGlowShader.vertexShader,
      fragmentShader: SimonGlowShader.fragmentShader,
      uniforms: material.uniforms,
      defines: { USE_SKINNING: '' },
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, [material]);

  // Sync settings to uniforms
  useEffect(() => {
    material.uniforms.uGlowIntensity.value = settings.simonGlowIntensity;
    if (settings.simonGlowColor) {
      material.uniforms.uColor.value.set(settings.simonGlowColor);
    }
  }, [settings.simonGlowIntensity, settings.simonGlowColor, material]);

  // Replace meshes' materials and restore on unmount
  useEffect(() => {
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

    meshes.forEach((mesh) => {
      if (!mesh) return;
      originalMaterials.set(mesh, mesh.material);

      const isSkinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh;
      mesh.material = isSkinned ? skinnedMaterial : material;
      mesh.visible = true;
      mesh.frustumCulled = false;
    });

    return () => {
      meshes.forEach((mesh) => {
        if (!mesh) return;
        if (originalMaterials.has(mesh)) {
          mesh.material = originalMaterials.get(mesh)!;
        }
      });
    };
  }, [meshes, material, skinnedMaterial]);

  useFrame((state) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // Update only if this scene is visible
    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);
    if (!isVisible) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return null;
};
