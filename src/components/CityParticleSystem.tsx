"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { CityHologramShader } from "@/shaders/cityHologramShader";

interface CityParticleSystemProps {
  /** Array of THREE.Mesh objects to convert into a holographic particle cloud */
  meshes: THREE.Mesh[];
}

/**
 * CityParticleSystem
 *
 * Takes an array of city meshes, extracts all vertices and vertex colors,
 * and renders them as a holographic architectural particle cloud.
 * Features: scan lines, grid overlay, edge glow, data flicker, glitch bursts.
 * No mouse interaction or physics — purely visual, optimized for performance.
 */
export const CityParticleSystem: React.FC<CityParticleSystemProps> = ({ meshes }) => {
  const { settings } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  // Glitch state for autonomous bursts
  const [isGlitchActive, setIsGlitchActive] = useState(false);
  const glitchStrengthRef = useRef(0);
  const glitchSeedRef = useRef(0);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

  // Set up uniforms for the holographic shader
  const uniforms = useMemo(() => {
    return {
      uTime: { value: 0 },
      uPointSize: { value: settings.pointSize },
      uNoiseStrength: { value: settings.noiseStrength },
      uNoiseSpeed: { value: settings.noiseSpeed },
      uOpacity: { value: settings.opacity },
      uGlitchStrength: { value: 0.0 },
      uGlitchSeed: { value: 0.0 },

      // Holographic scan lines
      uScanLineSpeed: { value: 1.5 },
      uScanLineDensity: { value: 8.0 },
      uScanLineIntensity: { value: 0.6 },

      // Grid overlay
      uGridScale: { value: 0.5 },
      uGridIntensity: { value: 0.4 },

      // Flicker
      uFlickerSpeed: { value: 8.0 },
      uFlickerIntensity: { value: 0.3 },

      // Color palette - Blue/Cyan holographic
      uHoloColorPrimary: { value: new THREE.Color(0.05, 0.15, 0.6) },     // Deep blue
      uHoloColorSecondary: { value: new THREE.Color(0.1, 0.6, 0.9) },     // Cyan
      uHoloColorEdge: { value: new THREE.Color(0.4, 0.8, 1.0) },          // Bright edge highlight

      // Edge glow
      uEdgeGlow: { value: 0.8 },

      // Atmospheric depth
      uAtmosphericFade: { value: 0.7 },
    };
  }, []);

  // Update shared uniforms reactively
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uPointSize.value = settings.pointSize;
    u.uNoiseStrength.value = settings.noiseStrength;
    u.uNoiseSpeed.value = settings.noiseSpeed;
    u.uOpacity.value = settings.opacity;
  }, [settings]);

  // ─── Autonomous Glitch Burst Scheduler ───
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let flickerIntervalId: ReturnType<typeof setInterval> | null = null;

    const triggerGlitch = () => {
      glitchSeedRef.current = Math.random() * 1000.0;
      setIsGlitchActive(true);

      // Rapid seed cycling for aggressive flicker
      flickerIntervalId = setInterval(() => {
        glitchSeedRef.current = Math.random() * 1000.0;
      }, 50 + Math.random() * 60);

      // Burst duration
      const durationBase = settingsRef.current.glitchDuration * 1000;
      const activeDuration = durationBase + (Math.random() - 0.5) * (durationBase * 0.5);

      timeoutId = setTimeout(() => {
        if (flickerIntervalId) clearInterval(flickerIntervalId);
        flickerIntervalId = null;
        setIsGlitchActive(false);

        // Calm period
        const intervalBase = settingsRef.current.glitchInterval * 1000;
        const waitDuration = intervalBase + (Math.random() - 0.5) * (intervalBase * 0.5);
        timeoutId = setTimeout(triggerGlitch, waitDuration);
      }, activeDuration);
    };

    timeoutId = setTimeout(triggerGlitch, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (flickerIntervalId) clearInterval(flickerIntervalId);
    };
  }, []);

  // Animate per frame
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

      // Smoothly lerp glitch strength
      const targetGlitch = isGlitchActive ? settingsRef.current.glitchIntensity * 0.5 : 0.0;
      glitchStrengthRef.current = THREE.MathUtils.lerp(
        glitchStrengthRef.current,
        targetGlitch,
        isGlitchActive ? 0.35 : 0.12
      );
      materialRef.current.uniforms.uGlitchStrength.value = glitchStrengthRef.current;
      materialRef.current.uniforms.uGlitchSeed.value = glitchSeedRef.current;
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
        vertexShader={CityHologramShader.vertexShader}
        fragmentShader={CityHologramShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
