"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TvScreenShader } from "@/shaders/tvScreenShader";
import { useSimulation } from "@/context/SimulationContext";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";

interface TvScreensGlowSystemProps {
  scene: THREE.Object3D;
}

export const TvScreensGlowSystem: React.FC<TvScreensGlowSystemProps> = ({ scene }) => {
  const { settings } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const extractedTextureRef = useRef<THREE.Texture | null>(null);

  // Initialize shader material and attach to TV screen mesh(es)
  useEffect(() => {
    if (!scene) return;

    // Create shader material cloned from TvScreenShader + shared atmosphere uniforms
    const mat = new THREE.ShaderMaterial({
      vertexShader: TvScreenShader.vertexShader,
      fragmentShader: TvScreenShader.fragmentShader,
      uniforms: {
        ...THREE.UniformsUtils.clone(TvScreenShader.uniforms),
        ...atmosphereUniforms,
      },
      side: THREE.DoubleSide,
      depthWrite: true,
      transparent: false,
    });

    mat.uniforms.uIntensity.value = settings.tvScreenIntensity ?? 3.5;
    if (settings.tvScreenColor) {
      mat.uniforms.uColor.value.set(settings.tvScreenColor);
    }
    mat.uniforms.uFlicker.value = settings.tvScreenFlicker !== false ? 0.1 : 0.0;
    mat.uniforms.uScanlines.value = settings.tvScreenScanlines !== false ? 0.25 : 0.0;

    materialRef.current = mat;

    const detectedMeshes: THREE.Mesh[] = [];
    const originalMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    let foundTexture: THREE.Texture | null = null;

    // Traverse scene to locate screenOfTvs or meshes with EMISSION material
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const childName = (child.name || "").toLowerCase();
      let isTvScreen = childName === "screenoftvs";

      if (!isTvScreen && child.material) {
        if (Array.isArray(child.material)) {
          isTvScreen = child.material.some((m) => m && m.name === "EMISSION");
        } else {
          isTvScreen = child.material.name === "EMISSION";
        }
      }

      if (isTvScreen) {
        originalMats.set(child, child.material);

        // Extract the original TV graphics texture from the EMISSION material
        const orig = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
        const tex = orig?.map || orig?.emissiveMap || null;
        if (tex) {
          foundTexture = tex;
          mat.uniforms.uMap.value = tex;
          mat.uniforms.uHasMap.value = 1.0;
        }

        if (settings.tvScreenMode === "native" && orig) {
          // Direct native material boost mode
          orig.emissive.set(settings.tvScreenColor || "#ffffff");
          orig.emissiveIntensity = settings.tvScreenIntensity ?? 3.5;
          if (orig.map && !orig.emissiveMap) {
            orig.emissiveMap = orig.map;
          }
          orig.needsUpdate = true;
          child.material = orig;
        } else {
          // Enhanced LED TV shader mode
          child.material = mat;
        }

        child.visible = true;
        child.frustumCulled = false;
        detectedMeshes.push(child);
      }
    });

    extractedTextureRef.current = foundTexture;
    meshesRef.current = detectedMeshes;
    originalMaterialsRef.current = originalMats;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[TvScreensGlowSystem] Attached TV LED glow (${settings.tvScreenMode ?? "shader"} mode, hasTexture: ${!!foundTexture}) to ${detectedMeshes.length} screen mesh(es):`,
        detectedMeshes.map((m) => m.name || "unnamed")
      );
    }

    return () => {
      // Teardown: restore original materials and dispose custom shader
      originalMats.forEach((origMat, mesh) => {
        if (mesh) {
          mesh.material = origMat;
          // Reset native props if modified
          const m = (Array.isArray(origMat) ? origMat[0] : origMat) as THREE.MeshStandardMaterial;
          if (m && m.isMeshStandardMaterial) {
            m.emissiveIntensity = 1.0;
          }
        }
      });
      originalMats.clear();
      meshesRef.current = [];
      mat.dispose();
      materialRef.current = null;
      extractedTextureRef.current = null;
    };
  }, [scene, settings.tvScreenMode]);

  // Synchronize uniforms & native properties when settings change
  useEffect(() => {
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uIntensity.value = settings.tvScreenIntensity ?? 3.5;
      if (settings.tvScreenColor) {
        mat.uniforms.uColor.value.set(settings.tvScreenColor);
      }
      mat.uniforms.uFlicker.value = settings.tvScreenFlicker !== false ? 0.1 : 0.0;
      mat.uniforms.uScanlines.value = settings.tvScreenScanlines !== false ? 0.25 : 0.0;
    }

    // Also update native material if active
    if (settings.tvScreenMode === "native") {
      meshesRef.current.forEach((mesh) => {
        const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        if (m && m.isMeshStandardMaterial) {
          m.emissive.set(settings.tvScreenColor || "#ffffff");
          m.emissiveIntensity = settings.tvScreenIntensity ?? 3.5;
          m.needsUpdate = true;
        }
      });
    }
  }, [
    settings.tvScreenIntensity,
    settings.tvScreenColor,
    settings.tvScreenFlicker,
    settings.tvScreenScanlines,
    settings.tvScreenMode,
  ]);

  // Animate clock for scanlines, static noise, and screen flicker
  useFrame((state) => {
    const mat = materialRef.current;
    if (mat && settings.tvScreenMode !== "native") {
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return null;
};
