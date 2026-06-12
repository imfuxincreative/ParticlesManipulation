"use client";

import React, { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { CityXRayShader } from "@/shaders/cityXRayShader";
import { CityXRayLineShader } from "@/shaders/cityXRayLineShader";

interface CityXRayMeshSystemProps {
  meshes: THREE.Mesh[];
}

/**
 * CityXRayMeshSystem
 *
 * Replaces the original materials of the city meshes with a custom
 * holographic architectural X-Ray shader. This preserves the original
 * hierarchy, transforms, and animations from the GLTF scene.
 */
export const CityXRayMeshSystem: React.FC<CityXRayMeshSystemProps> = ({ meshes }) => {
  const { settings } = useSimulation();

  // Create the shared X-Ray material
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: CityXRayShader.vertexShader,
      fragmentShader: CityXRayShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(CityXRayShader.uniforms),
      transparent: true,
      depthWrite: false, // Don't write to depth buffer to allow x-ray see-through
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

  // Track the current animated depth value (used for smooth lerping)
  const animState = useMemo(() => ({ currentDepth: settings.xrayBorderRevealDepth ?? 40.0 }), []);

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
    
    // Update border color and opacity
    lineMaterial.uniforms.uColor.value.set(settings.xrayBorderColor || "#e91e63");
    lineMaterial.uniforms.uOpacity.value = settings.xrayBorderOpacity ?? 0.5;

    // We can also tie scanline speed to noiseSpeed if we want it to react to global controls
    if (settings.noiseSpeed !== undefined) {
       material.uniforms.uScanLineSpeed.value = settings.noiseSpeed * 2.0;
    }

    // Hover Settings
    material.uniforms.uHoverColor.value.set(settings.xrayBorderColor || "#e91e63");
    material.uniforms.uHoverRadius.value = settings.xrayHoverRadius ?? 10.0;
  }, [settings, material, lineMaterial]);

  // Apply the material to the original meshes and add edge lines
  useEffect(() => {
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const edgeLines: THREE.LineSegments[] = [];
    
    meshes.forEach((mesh) => {
      originalMaterials.set(mesh, mesh.material);
      mesh.material = material;
      mesh.visible = true; // Override the visible=false set in SceneModel

      // Extract and add wireframe/edges based on the threshold angle
      const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, settings.xrayBorderThreshold ?? 15);
      const line = new THREE.LineSegments(edgesGeo, lineMaterial);
      mesh.add(line);
      edgeLines.push(line);
    });

    return () => {
      // Restore on unmount
      meshes.forEach((mesh, index) => {
        if (originalMaterials.has(mesh)) {
          mesh.material = originalMaterials.get(mesh)!;
        }
        mesh.visible = false;
        
        // Remove and cleanup edges
        const line = edgeLines[index];
        mesh.remove(line);
        line.geometry.dispose();
      });
    };
  }, [meshes, material, lineMaterial, settings.xrayBorderThreshold]);

  // Animate: update time + smoothly lerp depth reveal with 0.2s delay
  useFrame((state, delta) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;

    // Target depth from settings
    const targetDepth = settings.xrayBorderRevealDepth ?? 40.0;
    
    // Smooth lerp towards target with ~0.2s delay
    // lerpFactor: 1 - e^(-dt / tau), where tau = 0.2s
    const lerpSpeed = 1.0 - Math.exp(-delta / 0.2);
    animState.currentDepth += (targetDepth - animState.currentDepth) * lerpSpeed;
    
    // Push animated value to the shader
    lineMaterial.uniforms.uDepthLimit.value = animState.currentDepth;

    // --- Interactive Hover Raycasting ---
    state.raycaster.setFromCamera(state.pointer, state.camera);
    
    // Intersect all city meshes
    const hits = state.raycaster.intersectObjects(meshes, false);
    
    if (hits.length > 0 && hits[0].point) {
      material.uniforms.uMouseWorld.value.copy(hits[0].point);
      material.uniforms.uHoverActive.value = 1.0;
    } else {
      material.uniforms.uHoverActive.value = 0.0;
    }
  });

  return null;
};
