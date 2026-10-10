"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SimonGlowShader } from "@/shaders/simonGlowShader";
import { useSimulation } from "@/context/SimulationContext";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";

interface SimonGlowSystemProps {
  meshes: THREE.Mesh[];
  sceneIndex: number;
}

export const SimonGlowSystem: React.FC<SimonGlowSystemProps> = ({ meshes, sceneIndex }) => {
  const { settings } = useSimulation();
  const activeMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SimonGlowShader.vertexShader,
      fragmentShader: SimonGlowShader.fragmentShader,
      uniforms: {
        ...THREE.UniformsUtils.clone(SimonGlowShader.uniforms),
        ...atmosphereUniforms,
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, []);

  const skinnedMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SimonGlowShader.vertexShader,
      fragmentShader: SimonGlowShader.fragmentShader,
      uniforms: material.uniforms,
      defines: { USE_SKINNING: "" },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, [material]);

  useEffect(() => {
    const mats = [material, skinnedMaterial, ...activeMaterialsRef.current];
    mats.forEach((mat) => {
      mat.uniforms.uGlowIntensity.value = settings.simonGlowIntensity;
      if (mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = settings.simonGlowOpacity;
      if (settings.simonGlowColor) {
        mat.uniforms.uColor.value.set(settings.simonGlowColor);
      }
    });
  }, [settings.simonGlowIntensity, settings.simonGlowOpacity, settings.simonGlowColor, material, skinnedMaterial, meshes]);

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
        
        // Ensure shared atmosphere uniforms references are preserved after clone
        Object.assign(clonedMat.uniforms, atmosphereUniforms);

        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        if (bbox) {
          clonedMat.uniforms.uLocalMin = { value: bbox.min.clone() };
          clonedMat.uniforms.uLocalMax = { value: bbox.max.clone() };
        }

        const lowerName = mesh.name ? mesh.name.toLowerCase() : "";
        const isHairOrGlass =
          lowerName === "hair2.001" ||
          lowerName === "hair2" ||
          lowerName === "hair.001" ||
          lowerName === "hair" ||
          lowerName === "glass.001" ||
          lowerName === "glass";
        clonedMat.uniforms.uIsHair = { value: isHairOrGlass ? 1.0 : 0.0 };

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
      clonedMaterials.forEach((mat) => mat.dispose());
      activeMaterialsRef.current = [];
    };
  }, [meshes, material, skinnedMaterial]);

  useFrame((state) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);
    if (!isVisible) return;

    const mats = [material, skinnedMaterial, ...activeMaterialsRef.current];
    mats.forEach((mat) => {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    });
  });

  return null;
};
