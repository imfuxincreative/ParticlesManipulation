"use client";

import React, { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { CityXRayShader } from "@/shaders/cityXRayShader";
import { CityXRayLineShader } from "@/shaders/cityXRayLineShader";

interface CityXRayMeshSystemProps {
  meshes: THREE.Mesh[];
  projectionBounds?: { min: number; max: number };
}

/**
 * CityXRayMeshSystem
 *
 * Replaces the original materials of the city meshes with a custom
 * holographic architectural X-Ray shader. This preserves the original
 * hierarchy, transforms, and animations from the GLTF scene.
 */
export const CityXRayMeshSystem: React.FC<CityXRayMeshSystemProps> = ({ meshes, projectionBounds }) => {
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
      originalMaterials.set(mesh, mesh.material);

      // Use skinned variant for SkinnedMesh, base for regular Mesh
      const isSkinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh;
      mesh.material = isSkinned ? skinnedMaterial : material;
      mesh.visible = true; // Override the visible=false set in SceneModel

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

        line = skinnedLine;
      } else {
        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, settings.xrayBorderThreshold ?? 15);
        line = new THREE.LineSegments(edgesGeo, lineMaterial);
      }

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
        if ((line as any).geometry) {
          (line as any).geometry.dispose();
        }
      });
    };
  }, [meshes, material, lineMaterial, skinnedMaterial, skinnedLineMaterial, settings.xrayBorderThreshold]);

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
    
    // --- Scroll Burnout Calculation ---
    // Disabled so city hologram and pink x-ray lines don't disappear on scroll
    const burnOut = 0.0;
    material.uniforms.uBurnOut.value = burnOut;
    lineMaterial.uniforms.uBurnOut.value = burnOut;
    lineMaterial.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return null;
};
