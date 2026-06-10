"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { CityParticleShader } from "@/shaders/cityShader";

interface CityParticleSystemProps {
  /** Array of THREE.Mesh objects to convert into a static particle cloud */
  meshes: THREE.Mesh[];
}

/**
 * CityParticleSystem
 *
 * Takes an array of city meshes, extracts all their vertices and vertex colors,
 * and renders them as a massive, static particle (point cloud) system.
 * No mouse interaction or physics — purely visual, optimized for performance.
 */
export const CityParticleSystem: React.FC<CityParticleSystemProps> = ({ meshes }) => {
  const { settings } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  // Extract all vertices and vertex colors from the provided meshes
  const { positions, colors, vertexCount } = useMemo(() => {
    const allPositions: number[] = [];
    const allColors: number[] = [];
    const tempPos = new THREE.Vector3();

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      if (!geometry || !geometry.attributes.position) continue;

      const posAttr = geometry.attributes.position;
      const colorAttr = geometry.attributes.color;
      const worldMatrix = mesh.matrixWorld;

      // Extract material color if available
      let matColor = new THREE.Color(0.7, 0.7, 0.7);
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.color) {
          matColor = mat.color;
        }
      }

      for (let i = 0; i < posAttr.count; i++) {
        tempPos.set(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );

        // Apply world transform so particles sit at their correct world positions
        tempPos.applyMatrix4(worldMatrix);

        allPositions.push(tempPos.x, tempPos.y, tempPos.z);

        if (colorAttr) {
          allColors.push(
            colorAttr.getX(i),
            colorAttr.getY(i),
            colorAttr.getZ(i)
          );
        } else {
          // Use the material color as vertex color
          allColors.push(matColor.r, matColor.g, matColor.b);
        }
      }
    }

    console.log(`[CityParticleSystem] Extracted ${allPositions.length / 3} vertices from ${meshes.length} city meshes`);

    return {
      positions: new Float32Array(allPositions),
      colors: new Float32Array(allColors),
      vertexCount: allPositions.length / 3,
    };
  }, [meshes]);

  // Set up uniforms
  const uniforms = useMemo(() => {
    return {
      uTime: { value: 0 },
      uNoiseStrength: { value: settings.noiseStrength },
      uNoiseSpeed: { value: settings.noiseSpeed },
      uPointSize: { value: settings.pointSize },
      uFocusDepth: { value: settings.focusDepth },
      uFocusRange: { value: settings.focusRange },
      uBokehScale: { value: settings.bokehScale },
      uHazeColor: { value: new THREE.Color(settings.hazeColor) },
      uHazeDensity: { value: settings.hazeDensity },
      uTint: { value: new THREE.Color(settings.tintColor) },
      uTintMix: { value: settings.tintMix },
      uOpacity: { value: settings.opacity },
      uDensityControl: { value: settings.densityControl },
    };
  }, []);

  // Update uniforms reactively when settings change
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uNoiseStrength.value = settings.noiseStrength;
    u.uNoiseSpeed.value = settings.noiseSpeed;
    u.uPointSize.value = settings.pointSize;
    u.uFocusDepth.value = settings.focusDepth;
    u.uFocusRange.value = settings.focusRange;
    u.uBokehScale.value = settings.bokehScale;
    u.uHazeColor.value.set(settings.hazeColor);
    u.uHazeDensity.value = settings.hazeDensity;
    u.uTint.value.set(settings.tintColor);
    u.uTintMix.value = settings.tintMix;
    u.uOpacity.value = settings.opacity;
    u.uDensityControl.value = settings.densityControl;
  }, [settings]);

  // Animate time uniform
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (vertexCount === 0) {
    return null;
  }

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={CityParticleShader.vertexShader}
        fragmentShader={CityParticleShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
};
