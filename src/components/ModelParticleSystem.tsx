"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { ModelParticleShader } from "@/shaders/modelShader";

/**
 * ModelParticleSystem
 *
 * Loads a 3D model (.glb/.gltf), extracts vertices, and renders them as a
 * point cloud. Triggers automatic, randomized SCREEN-SPACE glitch bursts
 * with rapid seed cycling for aggressive data-corruption style distortion.
 */
export const ModelParticleSystem: React.FC = () => {
  const { settings } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const boxMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  
  // Interval scanning states
  const [isGlitchActive, setIsGlitchActive] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  
  const glitchStrengthRef = useRef(0);
  const glitchSeedRef = useRef(0);

  // Load the GLTF model
  const gltf = useGLTF(settings.modelUrl);

  // Extract all vertices and vertex colors from the loaded model
  const { extractedPositions, extractedColors } = useMemo(() => {
    const allPositions: number[] = [];
    const allColors: number[] = [];
    const tempPos = new THREE.Vector3();

    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry;

      if (!geometry || !geometry.attributes.position) return;

      const posAttr = geometry.attributes.position;
      const colorAttr = geometry.attributes.color;

      const worldMatrix = mesh.matrixWorld;

      for (let i = 0; i < posAttr.count; i++) {
        tempPos.set(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );

        tempPos.applyMatrix4(worldMatrix);

        allPositions.push(tempPos.x, tempPos.y, tempPos.z);

        if (colorAttr) {
          allColors.push(
            colorAttr.getX(i),
            colorAttr.getY(i),
            colorAttr.getZ(i)
          );
        } else {
          allColors.push(0.7, 0.7, 0.7);
        }
      }
    });

    console.log(`[ModelParticleSystem] Extracted ${allPositions.length / 3} vertices from model`);

    return {
      extractedPositions: new Float32Array(allPositions),
      extractedColors: new Float32Array(allColors),
    };
  }, [gltf]);

  // Sample vertices based on gridSize, and apply depthScale/centering
  const { centeredPositions, colors, modelScale, boxSize } = useMemo(() => {
    if (extractedPositions.length === 0) {
      return { centeredPositions: new Float32Array(0), colors: new Float32Array(0), modelScale: 1, boxSize: null };
    }

    const targetCount = settings.gridSize * settings.gridSize;
    const sourceCount = extractedPositions.length / 3;
    
    const sampledPositions = new Float32Array(targetCount * 3);
    const sampledColors = new Float32Array(targetCount * 3);

    // Uniformly sample vertices from the extracted pool
    const step = sourceCount / targetCount;
    for (let i = 0; i < targetCount; i++) {
      const srcIdx = Math.floor((i * step) % sourceCount) * 3;
      
      // Add slight jitter if we're duplicating vertices to avoid z-fighting
      const jitterAmount = (targetCount > sourceCount) ? 0.005 : 0;
      
      sampledPositions[i * 3] = extractedPositions[srcIdx] + (Math.random() - 0.5) * jitterAmount;
      sampledPositions[i * 3 + 1] = extractedPositions[srcIdx + 1] + (Math.random() - 0.5) * jitterAmount;
      sampledPositions[i * 3 + 2] = extractedPositions[srcIdx + 2] + (Math.random() - 0.5) * jitterAmount;
      
      sampledColors[i * 3] = extractedColors[srcIdx];
      sampledColors[i * 3 + 1] = extractedColors[srcIdx + 1];
      sampledColors[i * 3 + 2] = extractedColors[srcIdx + 2];
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < sampledPositions.length; i += 3) {
      minX = Math.min(minX, sampledPositions[i]);
      minY = Math.min(minY, sampledPositions[i + 1]);
      minZ = Math.min(minZ, sampledPositions[i + 2]);
      maxX = Math.max(maxX, sampledPositions[i]);
      maxY = Math.max(maxY, sampledPositions[i + 1]);
      maxZ = Math.max(maxZ, sampledPositions[i + 2]);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDim = Math.max(sizeX, sizeY, sizeZ);

    const targetSize = 8;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;

    for (let i = 0; i < sampledPositions.length; i += 3) {
      sampledPositions[i] = (sampledPositions[i] - cx) * scale;
      sampledPositions[i + 1] = (sampledPositions[i + 1] - cy) * scale;
      // Apply Z-depth stretch setting
      sampledPositions[i + 2] = (sampledPositions[i + 2] - cz) * scale * settings.depthScale;
    }

    return {
      centeredPositions: sampledPositions,
      colors: sampledColors,
      modelScale: scale,
      boxSize: [sizeX * scale, sizeY * scale, sizeZ * scale * settings.depthScale] as [number, number, number]
    };
  }, [extractedPositions, extractedColors, settings.gridSize, settings.depthScale]);

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
      uGlitchStrength: { value: 0.0 },
      uGlitchSeed: { value: 0.0 },
    };
  }, []);

  // Update uniforms reactively
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

  // ─── Autonomous Rapid-Fire Glitch Burst Scheduler ───
  useEffect(() => {
    if (centeredPositions.length === 0) return;

    let timeoutId: NodeJS.Timeout;
    let flickerIntervalId: ReturnType<typeof setInterval> | null = null;

    const triggerGlitch = () => {
      // Pick 5 random indices for measurement lines
      const count = centeredPositions.length / 3;
      if (count > 0) {
        const indices: number[] = [];
        for (let i = 0; i < 5; i++) {
          indices.push(Math.floor(Math.random() * count));
        }
        setSelectedIndices(indices);
      }

      // Set initial random seed
      glitchSeedRef.current = Math.random() * 1000.0;

      setIsGlitchActive(true);

      // Rapid seed cycling: change seed every 50-100ms for fast flickering
      flickerIntervalId = setInterval(() => {
        glitchSeedRef.current = Math.random() * 1000.0;
      }, 50 + Math.random() * 60);

      // Active burst duration: 0.2s to 0.7s (short, aggressive bursts)
      const activeDuration = 200 + Math.random() * 500;

      timeoutId = setTimeout(() => {
        if (flickerIntervalId) clearInterval(flickerIntervalId);
        flickerIntervalId = null;

        setIsGlitchActive(false);

        // Calm period: 1.5s to 4.0s
        const waitDuration = 1500 + Math.random() * 2500;
        timeoutId = setTimeout(triggerGlitch, waitDuration);
      }, activeDuration);
    };

    // Start first scan after 1.2 seconds
    timeoutId = setTimeout(triggerGlitch, 1200);

    return () => {
      clearTimeout(timeoutId);
      if (flickerIntervalId) clearInterval(flickerIntervalId);
    };
  }, [centeredPositions]);

  // Compute positions of measurement line segments connecting the 5 random points
  const linePositions = useMemo(() => {
    if (selectedIndices.length < 5 || centeredPositions.length === 0) {
      return new Float32Array(0);
    }

    const coords = selectedIndices.map((idx) => {
      return new THREE.Vector3(
        centeredPositions[idx * 3],
        centeredPositions[idx * 3 + 1],
        centeredPositions[idx * 3 + 2]
      );
    });

    const verts: number[] = [];
    const addSegment = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      verts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    };

    // Connect vertices in a closed loop
    addSegment(coords[0], coords[1]);
    addSegment(coords[1], coords[2]);
    addSegment(coords[2], coords[3]);
    addSegment(coords[3], coords[4]);
    addSegment(coords[4], coords[0]);

    // Cross-connecting diagonals
    addSegment(coords[0], coords[2]);
    addSegment(coords[1], coords[3]);
    addSegment(coords[2], coords[4]);

    return new Float32Array(verts);
  }, [selectedIndices, centeredPositions]);

  // Animate glitch strength and bounding box jitter
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = elapsed;
      materialRef.current.uniforms.uGlitchSeed.value = glitchSeedRef.current;

      // Smoothly lerp glitch strength
      const targetGlitch = isGlitchActive ? 1.4 : 0.0;
      glitchStrengthRef.current = THREE.MathUtils.lerp(
        glitchStrengthRef.current,
        targetGlitch,
        isGlitchActive ? 0.35 : 0.12  // Fast attack, slower decay
      );
      materialRef.current.uniforms.uGlitchStrength.value = glitchStrengthRef.current;
    }

    // Bounding box twitching
    if (boxRef.current) {
      if (glitchStrengthRef.current > 0.01) {
        const scaleJitter = 1.0 + (Math.random() - 0.5) * 0.03 * glitchStrengthRef.current;
        boxRef.current.scale.set(scaleJitter, scaleJitter, scaleJitter);
        
        boxRef.current.position.set(
          (Math.random() - 0.5) * 0.06 * glitchStrengthRef.current,
          (Math.random() - 0.5) * 0.06 * glitchStrengthRef.current,
          (Math.random() - 0.5) * 0.06 * glitchStrengthRef.current
        );
      } else {
        boxRef.current.scale.set(1.0, 1.0, 1.0);
        boxRef.current.position.set(0, 0, 0);
      }
    }

    // Dynamic opacities for box and lines
    if (boxMaterialRef.current) {
      const targetOpacity = isGlitchActive ? 0.35 : 0.08;
      boxMaterialRef.current.opacity = THREE.MathUtils.lerp(
        boxMaterialRef.current.opacity,
        targetOpacity,
        0.1
      );
    }

    if (lineMaterialRef.current) {
      lineMaterialRef.current.opacity = glitchStrengthRef.current * 0.45;
    }
  });

  if (centeredPositions.length === 0) {
    return null;
  }

  return (
    <group>
      {/* Particle cloud mesh */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[centeredPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={ModelParticleShader.vertexShader}
          fragmentShader={ModelParticleShader.fragmentShader}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>

      {/* Wireframe Bounding Box Helper */}
      {boxSize && (
        <mesh ref={boxRef}>
          <boxGeometry args={boxSize} />
          <meshBasicMaterial
            ref={boxMaterialRef}
            color="#ffffff"
            wireframe={true}
            transparent={true}
            opacity={0.08}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Measurement Telemetry Web Lines */}
      {selectedIndices.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            ref={lineMaterialRef}
            color="#ffffff"
            transparent={true}
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>
      )}
    </group>
  );
};
