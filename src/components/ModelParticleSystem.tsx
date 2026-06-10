"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useScroll } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "@react-three/postprocessing";
import { useSimulation } from "@/context/SimulationContext";
import { ModelParticleShader } from "@/shaders/modelShader";
import { Datamosh } from "@/effects/DatamoshEffect";

/**
 * ModelParticleSystem
 *
 * Loads a 3D model (.glb/.gltf), extracts vertices, and renders them as a
 * point cloud. Triggers automatic, randomized SCREEN-SPACE glitch bursts
 * with rapid seed cycling for aggressive data-corruption style distortion.
 */
interface ModelParticleSystemProps {
  meshes?: THREE.Mesh[];
  targetNode?: THREE.Object3D;
}

export const ModelParticleSystem: React.FC<ModelParticleSystemProps> = ({ meshes, targetNode }) => {
  const { settings, updateSetting } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const boxMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const scrollData = useScroll();
  const prevCycleRef = useRef(0);

  // Interval scanning states
  const [isGlitchActive, setIsGlitchActive] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const glitchStrengthRef = useRef(0);
  const glitchSeedRef = useRef(0);

  const bgGlitchStrengthRef = useRef(0);
  const bgGlitchSeedRef = useRef(0);
  const datamoshRef = useRef<any>(null);

  // ─── CPU Physics State ───
  const restPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(0));
  const scatterAmountsRef = useRef<Float32Array>(new Float32Array(0));
  const physicsReady = useRef(false);
  const prevPointerRef = useRef(new THREE.Vector2(-999, -999));
  const currentBoxSizeRef = useRef(new THREE.Vector3(1, 1, 1));

  // Load the active GLTF model
  const activeModel = settings.models[settings.currentModelIndex] || settings.models[0];
  const gltf = useGLTF(activeModel);

  // Extract all vertices and vertex colors from the loaded model
  const { extractedPositions, extractedColors } = useMemo(() => {
    const allPositions: number[] = [];
    const allColors: number[] = [];
    const tempPos = new THREE.Vector3();

    const sourceMeshes: THREE.Mesh[] = [];
    
    if (meshes) {
      sourceMeshes.push(...meshes);
    } else {
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) sourceMeshes.push(child);
      });
    }

    for (const mesh of sourceMeshes) {
      const geometry = mesh.geometry;

      if (!geometry || !geometry.attributes.position) continue;

      const posAttr = geometry.attributes.position;
      const colorAttr = geometry.attributes.color;

      const worldMatrix = mesh.matrixWorld;

      for (let i = 0; i < posAttr.count; i++) {
        tempPos.set(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );

        // If we are tracking a node, keep positions in local space
        if (!targetNode) {
          tempPos.applyMatrix4(worldMatrix);
        }

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
    }

    console.log(`[ModelParticleSystem] Extracted ${allPositions.length / 3} vertices from model`);

    return {
      extractedPositions: new Float32Array(allPositions),
      extractedColors: new Float32Array(allColors),
    };
  }, [gltf, meshes]);

  // Sample vertices based on gridSize, and apply depthScale/centering
  const { centeredPositions, colors, modelScale, boxSize, boxCenter } = useMemo(() => {
    if (extractedPositions.length === 0) {
      return { centeredPositions: new Float32Array(0), colors: new Float32Array(0), modelScale: 1, boxSize: null, boxCenter: null };
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

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // If targetNode is provided, bypass centering and scaling so it matches the original mesh exactly
    if (targetNode) {
      return {
        centeredPositions: sampledPositions,
        colors: sampledColors,
        modelScale: 1,
        boxSize: [sizeX, sizeY, sizeZ] as [number, number, number],
        boxCenter: [cx, cy, cz] as [number, number, number]
      };
    }

    const maxDim = Math.max(sizeX, sizeY, sizeZ);
    const targetSize = 8;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;

    for (let i = 0; i < sampledPositions.length; i += 3) {
      sampledPositions[i] = (sampledPositions[i] - cx) * scale;
      sampledPositions[i + 1] = (sampledPositions[i + 1] - cy) * scale;
      sampledPositions[i + 2] = (sampledPositions[i + 2] - cz) * scale;
    }

    return {
      centeredPositions: sampledPositions,
      colors: sampledColors,
      modelScale: scale,
      boxSize: [sizeX * scale, sizeY * scale, sizeZ * scale] as [number, number, number],
      boxCenter: [0, 0, 0] as [number, number, number]
    };
  }, [extractedPositions, extractedColors, settings.gridSize, targetNode]);

  // Create a mutable reference for positions for the GPU buffer (physics writes into this)
  const dynamicPositionsRef = useRef<Float32Array>(new Float32Array(0));

  // Initialize physics arrays when rest positions change
  useEffect(() => {
    if (centeredPositions.length === 0) return;

    // Update target rest positions for morphing
    restPositionsRef.current = new Float32Array(centeredPositions);

    if (!physicsReady.current || dynamicPositionsRef.current.length !== centeredPositions.length) {
      // First load or array size mismatch: initialize dynamic state
      velocitiesRef.current = new Float32Array(centeredPositions.length).fill(0);
      dynamicPositionsRef.current = new Float32Array(centeredPositions);
      scatterAmountsRef.current = new Float32Array(centeredPositions.length / 3).fill(0);
      physicsReady.current = true;
    }
    // If physics is already ready, DO NOT overwrite dynamicPositionsRef.
    // The easing physics will automatically morph particles to the new rest positions!
  }, [centeredPositions]);

  // ─── Autonomous Background Glitch Burst Scheduler ───
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let flickerIntervalId: ReturnType<typeof setInterval> | null = null;

    const triggerBgGlitch = () => {
      // Trigger burst
      bgGlitchStrengthRef.current = settingsRef.current.bgGlitchIntensity;

      // Fast seed cycling
      flickerIntervalId = setInterval(() => {
        bgGlitchSeedRef.current = Math.random() * 1000;
        // Randomly drop strength occasionally to create flicker
        bgGlitchStrengthRef.current = Math.random() > 0.3 ? settingsRef.current.bgGlitchIntensity : 0.0;
      }, 50); // 20fps flicker

      // End burst
      timeoutId = setTimeout(() => {
        if (flickerIntervalId) clearInterval(flickerIntervalId);
        bgGlitchStrengthRef.current = 0;

        // Schedule next burst
        const jitter = (Math.random() - 0.5) * 1.0;
        const nextInterval = Math.max(0.5, settingsRef.current.bgGlitchInterval + jitter) * 1000;
        timeoutId = setTimeout(triggerBgGlitch, nextInterval);
      }, settingsRef.current.bgGlitchDuration * 1000);
    };

    // Start cycle
    const initialJitter = Math.random() * settingsRef.current.bgGlitchInterval * 1000;
    timeoutId = setTimeout(triggerBgGlitch, initialJitter);

    return () => {
      clearTimeout(timeoutId);
      if (flickerIntervalId) clearInterval(flickerIntervalId);
    };
  }, []);

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
      uMouse: { value: new THREE.Vector2(-999, -999) },
      uAspect: { value: 1.0 },
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

      // Active burst duration based on settings (with some jitter)
      const durationBase = settingsRef.current.glitchDuration * 1000;
      const activeDuration = durationBase + (Math.random() - 0.5) * (durationBase * 0.5);

      timeoutId = setTimeout(() => {
        if (flickerIntervalId) clearInterval(flickerIntervalId);
        flickerIntervalId = null;

        setIsGlitchActive(false);

        // Calm period based on settings (with some jitter)
        const intervalBase = settingsRef.current.glitchInterval * 1000;
        const waitDuration = intervalBase + (Math.random() - 0.5) * (intervalBase * 0.5);
        timeoutId = setTimeout(triggerGlitch, waitDuration);
      }, activeDuration);
    };

    // Start first scan after a short delay
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
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uGlitchStrength.value = glitchStrengthRef.current;
      materialRef.current.uniforms.uGlitchSeed.value = glitchSeedRef.current;
      materialRef.current.uniforms.uMouse.value.copy(state.pointer);
      materialRef.current.uniforms.uAspect.value = state.viewport.aspect;

      // Smoothly lerp glitch strength
      const targetGlitch = isGlitchActive ? settings.glitchIntensity : 0.0;
      glitchStrengthRef.current = THREE.MathUtils.lerp(
        glitchStrengthRef.current,
        targetGlitch,
        isGlitchActive ? 0.35 : 0.12
      );
      materialRef.current.uniforms.uGlitchStrength.value = glitchStrengthRef.current;
    }

    // Update Datamosh postprocessing uniforms
    if (datamoshRef.current) {
      const effect = datamoshRef.current;
      effect.uniforms.get('strength').value = bgGlitchStrengthRef.current;
      effect.uniforms.get('seed').value = bgGlitchSeedRef.current;
    }

    // ─── CPU Particle Physics Simulation ───
    if (physicsReady.current && pointsRef.current && boxSize) {
      // Sync group transform to animated target node
      if (targetNode && groupRef.current) {
        groupRef.current.matrixAutoUpdate = false;
        groupRef.current.matrix.copy(targetNode.matrixWorld);
      }

      state.raycaster.setFromCamera(state.pointer, state.camera);
      
      let rx, ry, rz, rdx, rdy, rdz;
      let localSwipeDx, localSwipeDy, localSwipeDz = 0;

      // Calculate mouse velocity (swipe speed) in world space
      let pointerDelta = 0;
      let swipeDx = 0;
      let swipeDy = 0;
      if (prevPointerRef.current.x !== -999) {
        swipeDx = state.pointer.x - prevPointerRef.current.x;
        swipeDy = state.pointer.y - prevPointerRef.current.y;
        pointerDelta = Math.sqrt(swipeDx * swipeDx + swipeDy * swipeDy);
      }
      prevPointerRef.current.copy(state.pointer);

      const worldSwipeDx = swipeDx * 15.0; // scale up to match world space feel
      const worldSwipeDy = swipeDy * 15.0;

      // Check if mouse is over the bounding box
      let isHovering = false;
      if (boxRef.current) {
        const hits = state.raycaster.intersectObject(boxRef.current);
        isHovering = hits.length > 0;
      }

      // Convert Ray and Swipe to local space if targetNode is animating
      if (targetNode) {
        const inverseMatrix = new THREE.Matrix4().copy(targetNode.matrixWorld).invert();
        const localRay = new THREE.Ray();
        localRay.copy(state.raycaster.ray).applyMatrix4(inverseMatrix);
        rx = localRay.origin.x; ry = localRay.origin.y; rz = localRay.origin.z;
        rdx = localRay.direction.x; rdy = localRay.direction.y; rdz = localRay.direction.z;

        const swipeVec = new THREE.Vector3(worldSwipeDx, worldSwipeDy, 0);
        swipeVec.transformDirection(inverseMatrix);
        localSwipeDx = swipeVec.x; localSwipeDy = swipeVec.y; localSwipeDz = swipeVec.z;
      } else {
        const rayOrigin = state.raycaster.ray.origin;
        const rayDir = state.raycaster.ray.direction;
        rx = rayOrigin.x; ry = rayOrigin.y; rz = rayOrigin.z;
        rdx = rayDir.x; rdy = rayDir.y; rdz = rayDir.z;
        localSwipeDx = worldSwipeDx; localSwipeDy = worldSwipeDy; localSwipeDz = 0;
      }

      const rest = restPositionsRef.current;
      const vel = velocitiesRef.current;
      const posArr = dynamicPositionsRef.current;
      const count = posArr.length / 3;

      const scatterRadius = settingsRef.current.scatterRadius;
      const scatterRadius2 = scatterRadius * scatterRadius;
      const impulseStr = settingsRef.current.scatterStrength * 0.08;
      const DAMPING = 0.85; // High friction so swipe velocity dies out quickly
      const EASE = 0.05; // Smooth, non-elastic return to rest position

      // Smoothly animate the target box size
      currentBoxSizeRef.current.lerp(new THREE.Vector3(boxSize[0], boxSize[1], boxSize[2]), 0.04);

      // Box half-extents for clamping using the animated size
      const hx = currentBoxSizeRef.current.x / 2;
      const hy = currentBoxSizeRef.current.y / 2;
      const hz = currentBoxSizeRef.current.z / 2;

      const bcx = boxCenter ? boxCenter[0] : 0;
      const bcy = boxCenter ? boxCenter[1] : 0;
      const bcz = boxCenter ? boxCenter[2] : 0;

      // Only apply impulse if mouse is moving
      const isSwiping = isHovering && pointerDelta > 0.001;
      const currentImpulseStr = impulseStr * (pointerDelta * 50.0); // Scale by swipe speed

      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const iy = ix + 1;
        const iz = ix + 2;

        const px = posArr[ix], py = posArr[iy], pz = posArr[iz];

        // ── Scatter impulse (only when hovering the box AND swiping) ──
        if (isSwiping) {
          // Closest point on ray to this particle
          const tvx = px - rx, tvy = py - ry, tvz = pz - rz;
          const t = Math.max(0, tvx * rdx + tvy * rdy + tvz * rdz);
          const cpx = rx + rdx * t, cpy = ry + rdy * t, cpz = rz + rdz * t;

          const dfx = px - cpx, dfy = py - cpy, dfz = pz - cpz;
          const dist2 = dfx * dfx + dfy * dfy + dfz * dfz;

          if (dist2 < scatterRadius2 && dist2 > 0.0001) {
            const dist = Math.sqrt(dist2);
            const pushFactor = (1.0 - dist / scatterRadius);

            // Soft exponential falloff
            const pushMag = Math.pow(pushFactor, 6.0) * currentImpulseStr * 3.0;

            // Fast pseudo-random variation based on index to prevent perfect rings
            const noise = (Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453) % 1;
            const randVar = 0.5 + Math.abs(noise) * 1.5; // 0.5 to 2.0

            const invDist = 1.0 / dist;

            // Blend radial outward push (30%) with directional swipe drag (70%)
            const radialMag = pushMag * 0.3 * randVar;
            const dragMag = pushMag * 0.7 * randVar;

            vel[ix] += (dfx * invDist * radialMag) + (localSwipeDx * dragMag);
            vel[iy] += (dfy * invDist * radialMag) + (localSwipeDy * dragMag);
            vel[iz] += (dfz * invDist * radialMag) + (localSwipeDz * dragMag) + ((noise - 0.5) * dragMag * 0.2); // random Z drag
          }
        }

        // ── Damping (friction) ──
        vel[ix] *= DAMPING;
        vel[iy] *= DAMPING;
        vel[iz] *= DAMPING;

        // ── Update position with velocity ──
        let newX = px + vel[ix];
        let newY = py + vel[iy];
        let newZ = pz + vel[iz];

        // ── Smooth Easing back to rest (No elasticity/overshoot) ──
        newX += (rest[ix] - newX) * EASE;
        newY += (rest[iy] - newY) * EASE;
        newZ += (rest[iz] - newZ) * EASE;

        posArr[ix] = newX;
        posArr[iy] = newY;
        posArr[iz] = newZ;

        // ── Clamp within bounding box + bounce ──
        if (posArr[ix] < bcx - hx) { posArr[ix] = bcx - hx; vel[ix] *= -0.3; }
        else if (posArr[ix] > bcx + hx) { posArr[ix] = bcx + hx; vel[ix] *= -0.3; }
        if (posArr[iy] < bcy - hy) { posArr[iy] = bcy - hy; vel[iy] *= -0.3; }
        else if (posArr[iy] > bcy + hy) { posArr[iy] = bcy + hy; vel[iy] *= -0.3; }
        if (posArr[iz] < bcz - hz) { posArr[iz] = bcz - hz; vel[iz] *= -0.3; }
        else if (posArr[iz] > bcz + hz) { posArr[iz] = bcz + hz; vel[iz] *= -0.3; }

        // ── Compute scatter displacement for glow ──
        const dx = posArr[ix] - rest[ix];
        const dy = posArr[iy] - rest[iy];
        const dz = posArr[iz] - rest[iz];
        const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Normalize to 0..1 range (saturate at ~2 units displacement)
        scatterAmountsRef.current[i] = Math.min(displacement / 2.0, 1.0);
      }

      // Upload modified positions to GPU
      const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      posAttr.needsUpdate = true;

      // Upload scatter amounts to GPU
      const scatterAttr = pointsRef.current.geometry.attributes.aScatter as THREE.BufferAttribute;
      if (scatterAttr) {
        scatterAttr.needsUpdate = true;
      }
    }

    // Bounding box twitching and scaling
    if (boxRef.current) {
      const baseScaleX = currentBoxSizeRef.current.x;
      const baseScaleY = currentBoxSizeRef.current.y;
      const baseScaleZ = currentBoxSizeRef.current.z;

      const bcx = boxCenter ? boxCenter[0] : 0;
      const bcy = boxCenter ? boxCenter[1] : 0;
      const bcz = boxCenter ? boxCenter[2] : 0;

      if (glitchStrengthRef.current > 0.01) {
        const scaleJitter = 1.0 + (Math.random() - 0.5) * 0.03 * glitchStrengthRef.current;
        boxRef.current.scale.set(baseScaleX * scaleJitter, baseScaleY * scaleJitter, baseScaleZ * scaleJitter);

        boxRef.current.position.set(
          bcx + (Math.random() - 0.5) * 0.06 * glitchStrengthRef.current,
          bcy + (Math.random() - 0.5) * 0.06 * glitchStrengthRef.current,
          bcz + (Math.random() - 0.5) * 0.06 * glitchStrengthRef.current
        );
      } else {
        boxRef.current.scale.set(baseScaleX, baseScaleY, baseScaleZ);
        boxRef.current.position.set(bcx, bcy, bcz);
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

    // --- Scroll Animation ---
    if (scrollData && groupRef.current && !meshes) {
      const t = scrollData.offset; // 0..1
      const numModels = settingsRef.current.models.length;
      // Each scroll "page" = 1 full cycle. With pages=4 we get 4 cycles over the full scroll.
      const totalCycles = 4;
      const rawCycle = t * totalCycles; // 0..4 continuously
      const currentCycle = Math.floor(rawCycle);
      const cycleProgress = rawCycle - currentCycle; // 0..1 within current cycle

      // Detect when we cross into a new cycle -> switch model
      if (currentCycle !== prevCycleRef.current) {
        prevCycleRef.current = currentCycle;
        const nextModelIndex = currentCycle % numModels;
        if (nextModelIndex !== settingsRef.current.currentModelIndex) {
          updateSetting('currentModelIndex', nextModelIndex);
        }
      }

      // Rotation: full 360° per cycle (scroll-driven) + slow constant idle rotation
      const angle = cycleProgress * Math.PI * 2;
      const idleRotation = elapsed * 0.15; // Slow continuous spin
      groupRef.current.rotation.y = angle + idleRotation;
      // Subtle tilt for cinematic feel
      groupRef.current.rotation.x = Math.sin(angle) * 0.12;

      // Z position: start far away (-8), come close (0) at mid-cycle, go back far
      const farDistance = -8;
      const closeDistance = 0;
      const zRange = farDistance - closeDistance;
      groupRef.current.position.z = closeDistance + ((1 + Math.cos(angle)) / 2) * zRange;
    } else if (groupRef.current && !meshes) {
      // No scroll context — just apply idle rotation
      groupRef.current.rotation.y = elapsed * 0.15;
    }
  });

  if (centeredPositions.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {/* Postprocessing Stack */}
      <EffectComposer disableNormalPass multisampling={0}>
        <Datamosh ref={datamoshRef} strength={0} seed={0} />
      </EffectComposer>

      {/* Particle cloud mesh */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-aScatter"
            args={[scatterAmountsRef.current, 1]}
          />
          <bufferAttribute
            attach="attributes-position"
            args={[dynamicPositionsRef.current, 3]}
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
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            ref={boxMaterialRef}
            color="#ffffff"
            wireframe={true}
            transparent={true}
            opacity={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
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

useGLTF.preload("/model.glb");
useGLTF.preload("/bird.glb");
useGLTF.preload("/plane.glb");
useGLTF.preload("/myscene_v2.glb");

