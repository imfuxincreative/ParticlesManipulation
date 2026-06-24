"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, useScroll } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "@react-three/postprocessing";
import { useSimulation } from "@/context/SimulationContext";
import { ModelParticleShader } from "@/shaders/modelShader";
import { Datamosh } from "@/effects/DatamoshEffect";
import { CityXRayLineShader } from "@/shaders/cityXRayLineShader";
import { CityXRayShader } from "@/shaders/cityXRayShader";

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
  projectionBounds?: { min: number; max: number };
}

/**
 * Per-model rotation offsets (in DEGREES).
 * Adjust these to make each model appear upright.
 * [xRotation, yRotation, zRotation]
 * Try 90, -90, 180, or 0 to flip the model upright.
 */
const MODEL_ROTATION_OFFSETS_DEGREES: [number, number, number][] = [
  [90, -230, 0],   // model.glb
  [90, -230, 0],   // bird.glb
  [90, -230, 0],   // figure.glb
  [90, -230, 0],   // old_door.glb
];

export const ModelParticleSystem: React.FC<ModelParticleSystemProps> = ({ meshes, targetNode, projectionBounds }) => {
  const { settings, updateSetting } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const boxLinesRef = useRef<THREE.LineSegments>(null);
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

  const projectionBoundsRef = useRef(projectionBounds);
  useEffect(() => {
    projectionBoundsRef.current = projectionBounds;
  }, [projectionBounds]);

  const glitchStrengthRef = useRef(0);
  const glitchSeedRef = useRef(0);

  // ─── XRay Line Shader material for bounding box ───
  const boxLineMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: CityXRayLineShader.vertexShader,
      fragmentShader: CityXRayLineShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(CityXRayLineShader.uniforms),
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Animated depth state for the body box (mirrors city approach)
  const boxAnimState = useMemo(() => ({ currentDepth: settings.xrayBorderRevealDepth ?? 40.0 }), []);

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

  // ─── Solid model mesh and wireframe for transition phase ───
  const { solidMaterial, solidLineMaterial, solidSceneCloned } = useMemo(() => {
    // Only compile shaders and clone scene if we are on the last model
    if (!gltf || settings.currentModelIndex !== 2) {
      return { solidMaterial: null, solidLineMaterial: null, solidSceneCloned: null };
    }

    // Modify CityXRayShader to support uSolidWhiteProgress
    const modifiedFrag = CityXRayShader.fragmentShader.replace(
      'void main() {',
      `uniform float uSolidWhiteProgress;
      void main() {`
    ).replace(
      'gl_FragColor = vec4(baseHologramColor, finalAlpha);',
      `vec3 finalColor = mix(baseHologramColor, vec3(1.0), uSolidWhiteProgress);
      float finalAlphaTransition = mix(finalAlpha, uOpacity, uSolidWhiteProgress);
      gl_FragColor = vec4(finalColor, finalAlphaTransition);`
    );

    const mat = new THREE.ShaderMaterial({
      vertexShader: CityXRayShader.vertexShader,
      fragmentShader: modifiedFrag,
      uniforms: {
        ...THREE.UniformsUtils.clone(CityXRayShader.uniforms),
        uSolidWhiteProgress: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const lineMat = new THREE.ShaderMaterial({
      vertexShader: CityXRayLineShader.vertexShader,
      fragmentShader: CityXRayLineShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(CityXRayLineShader.uniforms),
      transparent: true,
      depthWrite: false,
    });

    const cloned = gltf.scene.clone();
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mat;
        
        // Remove existing lines if any, then add custom border lines
        const toRemove: THREE.Object3D[] = [];
        child.children.forEach(c => {
          if (c instanceof THREE.LineSegments) toRemove.push(c);
        });
        toRemove.forEach(c => child.remove(c));

        const edgesGeo = new THREE.EdgesGeometry(child.geometry, settings.xrayBorderThreshold ?? 15);
        const line = new THREE.LineSegments(edgesGeo, lineMat);
        child.add(line);
      }
    });

    return { solidMaterial: mat, solidLineMaterial: lineMat, solidSceneCloned: cloned };
  }, [gltf, settings.currentModelIndex, settings.xrayBorderThreshold]);

  // Compute bounding box of the body mesh for aligning switched models
  const bodyBBox = useMemo(() => {
    if (!meshes || meshes.length === 0) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const tempPos = new THREE.Vector3();

    for (const mesh of meshes) {
      const posAttr = mesh.geometry?.attributes.position;
      if (!posAttr) continue;
      for (let i = 0; i < posAttr.count; i++) {
        tempPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        minX = Math.min(minX, tempPos.x);
        minY = Math.min(minY, tempPos.y);
        minZ = Math.min(minZ, tempPos.z);
        maxX = Math.max(maxX, tempPos.x);
        maxY = Math.max(maxY, tempPos.y);
        maxZ = Math.max(maxZ, tempPos.z);
      }
    }

    return {
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2] as [number, number, number],
      size: [maxX - minX, maxY - minY, maxZ - minZ] as [number, number, number],
    };
  }, [meshes]);

  // Temp matrices for Y rotation around the bounding box center (avoid GC pressure)
  const rotMatrixRef = useRef(new THREE.Matrix4());
  const transToCenterRef = useRef(new THREE.Matrix4());
  const transBackRef = useRef(new THREE.Matrix4());
  const localTransformRef = useRef(new THREE.Matrix4());

  // Extract all vertices and vertex colors from the loaded model
  const { extractedPositions, extractedColors } = useMemo(() => {
    const allPositions: number[] = [];
    const allColors: number[] = [];
    const tempPos = new THREE.Vector3();

    const sourceMeshes: THREE.Mesh[] = [];

    // Always extract from the active GLTF model so arrow-key model switching works
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) sourceMeshes.push(child);
    });

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

        // Always apply world matrix to get vertices into model's world space
        // (they'll be re-centered and scaled to match the body in centeredPositions)
        tempPos.applyMatrix4(worldMatrix);

        allPositions.push(tempPos.x, tempPos.y, tempPos.z);

        if (colorAttr) {
          allColors.push(
            colorAttr.getX(i),
            colorAttr.getY(i),
            colorAttr.getZ(i)
          );
        } else {
          allColors.push(-1.0, -1.0, -1.0);
        }
      }
    }

    console.log(`[ModelParticleSystem] Extracted ${allPositions.length / 3} vertices from model`);

    return {
      extractedPositions: new Float32Array(allPositions),
      extractedColors: new Float32Array(allColors),
    };
  }, [gltf]);

  // Sample vertices based on gridSize, and apply depthScale/centering
  const { centeredPositions, colors, modelScale, boxSize, boxCenter, cOriginal, cRotated, modelRotation } = useMemo(() => {
    if (extractedPositions.length === 0) {
      return {
        centeredPositions: new Float32Array(0),
        colors: new Float32Array(0),
        modelScale: 1,
        boxSize: null,
        boxCenter: null,
        cOriginal: null,
        cRotated: null,
        modelRotation: null,
      };
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

    // Apply per-model upright correction rotation around the model's center (in degrees)
    const modelIdx = settings.currentModelIndex;
    const [oxDeg, oyDeg, ozDeg] = MODEL_ROTATION_OFFSETS_DEGREES[modelIdx] ?? [0, 0, 0];
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(oxDeg),
      THREE.MathUtils.degToRad(oyDeg),
      THREE.MathUtils.degToRad(ozDeg)
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const tempVec = new THREE.Vector3();

    for (let i = 0; i < sampledPositions.length; i += 3) {
      tempVec.set(
        sampledPositions[i] - cx,
        sampledPositions[i + 1] - cy,
        sampledPositions[i + 2] - cz
      );
      tempVec.applyQuaternion(quaternion);
      sampledPositions[i] = tempVec.x;
      sampledPositions[i + 1] = tempVec.y;
      sampledPositions[i + 2] = tempVec.z;
    }

    // Recalculate bounding box and center for the rotated vertices
    let rotMinX = Infinity, rotMinY = Infinity, rotMinZ = Infinity;
    let rotMaxX = -Infinity, rotMaxY = -Infinity, rotMaxZ = -Infinity;

    for (let i = 0; i < sampledPositions.length; i += 3) {
      rotMinX = Math.min(rotMinX, sampledPositions[i]);
      rotMinY = Math.min(rotMinY, sampledPositions[i + 1]);
      rotMinZ = Math.min(rotMinZ, sampledPositions[i + 2]);
      rotMaxX = Math.max(rotMaxX, sampledPositions[i]);
      rotMaxY = Math.max(rotMaxY, sampledPositions[i + 1]);
      rotMaxZ = Math.max(rotMaxZ, sampledPositions[i + 2]);
    }

    const sizeX = rotMaxX - rotMinX;
    const sizeY = rotMaxY - rotMinY;
    const sizeZ = rotMaxZ - rotMinZ;

    const rcx = (rotMinX + rotMaxX) / 2;
    const rcy = (rotMinY + rotMaxY) / 2;
    const rcz = (rotMinZ + rotMaxZ) / 2;

    // Center the rotated vertices at (0, 0, 0)
    for (let i = 0; i < sampledPositions.length; i += 3) {
      sampledPositions[i] -= rcx;
      sampledPositions[i + 1] -= rcy;
      sampledPositions[i + 2] -= rcz;
    }

    // If targetNode is provided, scale and center to match the body's bounding box
    if (targetNode) {
      if (bodyBBox) {
        const modelMaxDim = Math.max(sizeX, sizeY, sizeZ);
        const bodyMaxDim = Math.max(bodyBBox.size[0], bodyBBox.size[1], bodyBBox.size[2]);
        const fitScale = modelMaxDim > 0 ? bodyMaxDim / modelMaxDim : 1;

        for (let i = 0; i < sampledPositions.length; i += 3) {
          sampledPositions[i] = sampledPositions[i] * fitScale + bodyBBox.center[0];
          sampledPositions[i + 1] = sampledPositions[i + 1] * fitScale + bodyBBox.center[1];
          sampledPositions[i + 2] = sampledPositions[i + 2] * fitScale + bodyBBox.center[2];
        }

        return {
          centeredPositions: sampledPositions,
          colors: sampledColors,
          modelScale: fitScale,
          boxSize: [sizeX * fitScale, sizeY * fitScale, sizeZ * fitScale] as [number, number, number],
          boxCenter: bodyBBox.center,
          cOriginal: [cx, cy, cz] as [number, number, number],
          cRotated: [rcx, rcy, rcz] as [number, number, number],
          modelRotation: quaternion,
        };
      }

      // Fallback: no bodyBBox, pass through as-is (already centered at (0,0,0))
      return {
        centeredPositions: sampledPositions,
        colors: sampledColors,
        modelScale: 1,
        boxSize: [sizeX, sizeY, sizeZ] as [number, number, number],
        boxCenter: [0, 0, 0] as [number, number, number],
        cOriginal: [cx, cy, cz] as [number, number, number],
        cRotated: [rcx, rcy, rcz] as [number, number, number],
        modelRotation: quaternion,
      };
    }

    const maxDim = Math.max(sizeX, sizeY, sizeZ);
    const targetSize = 8;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;

    for (let i = 0; i < sampledPositions.length; i += 3) {
      sampledPositions[i] = sampledPositions[i] * scale;
      sampledPositions[i + 1] = sampledPositions[i + 1] * scale;
      sampledPositions[i + 2] = sampledPositions[i + 2] * scale;
    }

    return {
      centeredPositions: sampledPositions,
      colors: sampledColors,
      modelScale: scale,
      boxSize: [sizeX * scale, sizeY * scale, sizeZ * scale] as [number, number, number],
      boxCenter: [0, 0, 0] as [number, number, number],
      cOriginal: [cx, cy, cz] as [number, number, number],
      cRotated: [rcx, rcy, rcz] as [number, number, number],
      modelRotation: quaternion,
    };
  }, [extractedPositions, extractedColors, settings.gridSize, targetNode, bodyBBox, settings.currentModelIndex]);

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
      uPrimaryColor: { value: new THREE.Color(settings.xrayBorderColor || "#e91e63") },
      uParticleDefaultColor: { value: new THREE.Color(settings.particleDefaultColor || "#8d8d8d") },
      uBurnProgress: { value: 0.0 },
      uParticleOpacity: { value: 1.0 },
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
    if (u.uPrimaryColor) u.uPrimaryColor.value.set(settings.xrayBorderColor || "#e91e63");
    if (u.uParticleDefaultColor) u.uParticleDefaultColor.value.set(settings.particleDefaultColor || "#8d8d8d");
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
    // --- Scroll-Driven Model transition calculation ---
    let burnProgress = 0.0;
    let particleOpacity = 1.0;
    let solidWhiteProgress = 0.0;
    let solidOpacity = 0.0;

    if (scrollData && settings.currentModelIndex === 2) {
      const t = scrollData.offset; // 0..1
      if (t >= 0.88 && t < 0.94) {
        burnProgress = Math.min(1.0, (t - 0.88) / (0.94 - 0.88));
        solidWhiteProgress = 1.0;
        solidOpacity = 0.0; // Hide solid mesh during particle burn
        particleOpacity = 1.0; // Keep particles fully visible
      } else if (t >= 0.94) {
        burnProgress = 1.0;
        const hologramProgress = Math.min(1.0, (t - 0.94) / (1.0 - 0.94));
        solidWhiteProgress = 1.0 - hologramProgress;
        solidOpacity = 1.0; // Show solid mesh instantly
        particleOpacity = 0.0; // Turn off particles instantly
      }
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uGlitchStrength.value = glitchStrengthRef.current;
      materialRef.current.uniforms.uGlitchSeed.value = glitchSeedRef.current;
      materialRef.current.uniforms.uMouse.value.copy(state.pointer);
      materialRef.current.uniforms.uAspect.value = state.viewport.aspect;

      // Update burn progress and particle opacity
      materialRef.current.uniforms.uBurnProgress.value = burnProgress;
      materialRef.current.uniforms.uParticleOpacity.value = particleOpacity;

      // Smoothly lerp glitch strength
      const targetGlitch = isGlitchActive ? settings.glitchIntensity : 0.0;
      glitchStrengthRef.current = THREE.MathUtils.lerp(
        glitchStrengthRef.current,
        targetGlitch,
        isGlitchActive ? 0.35 : 0.12
      );
      materialRef.current.uniforms.uGlitchStrength.value = glitchStrengthRef.current;
    }

    // Update Solid Model Uniforms and Raycasting
    if (solidMaterial && solidLineMaterial && solidSceneCloned) {
      solidMaterial.uniforms.uTime.value = state.clock.elapsedTime;
      solidMaterial.uniforms.uOpacity.value = settings.opacity * solidOpacity;
      solidMaterial.uniforms.uFillOpacity.value = settings.xrayFillOpacity;
      solidMaterial.uniforms.uScanLineIntensity.value = settings.xrayScanlineIntensity;
      solidMaterial.uniforms.uFresnelPower.value = settings.xrayOutlinePower;
      solidMaterial.uniforms.uColor.value.set(settings.xrayBaseColor);
      solidMaterial.uniforms.uGlowColor.value.set(settings.xrayOutlineColor);
      solidMaterial.uniforms.uSolidWhiteProgress.value = solidWhiteProgress;
      solidMaterial.uniforms.uBurnOut.value = 0.0;

      solidLineMaterial.uniforms.uTime.value = state.clock.elapsedTime;
      solidLineMaterial.uniforms.uColor.value.set(settings.xrayBorderColor || "#e91e63");
      solidLineMaterial.uniforms.uOpacity.value = settings.xrayBorderOpacity * (1.0 - solidWhiteProgress) * solidOpacity;
      solidLineMaterial.uniforms.uDepthLimit.value = settings.xrayBorderRevealDepth ?? 40.0;
      solidLineMaterial.uniforms.uBurnOut.value = 0.0;

      if (projectionBoundsRef.current) {
        solidMaterial.uniforms.uMinProj.value = projectionBoundsRef.current.min;
        solidMaterial.uniforms.uMaxProj.value = projectionBoundsRef.current.max;
        solidLineMaterial.uniforms.uMinProj.value = projectionBoundsRef.current.min;
        solidLineMaterial.uniforms.uMaxProj.value = projectionBoundsRef.current.max;
      }

      // Solid model hover raycasting
      const meshesToIntersect: THREE.Mesh[] = [];
      solidSceneCloned.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshesToIntersect.push(child);
        }
      });
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObjects(meshesToIntersect, true);
      if (hits.length > 0 && hits[0].point) {
        solidMaterial.uniforms.uMouseWorld.value.copy(hits[0].point);
        solidMaterial.uniforms.uHoverActive.value = 1.0;
      } else {
        solidMaterial.uniforms.uHoverActive.value = 0.0;
      }
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

        // Apply local Z rotation around the bounding box center (slow auto-rotation + scroll rotation)
        const cx = boxCenter ? boxCenter[0] : 0;
        const cy = boxCenter ? boxCenter[1] : 0;
        const cz = boxCenter ? boxCenter[2] : 0;

        const elapsed = state.clock.getElapsedTime();
        const autoRotationSpeed = 0.15; // Slow idle Z rotation
        const scrollRotationSpeed = Math.PI * 4; // 2 full Z rotations over the 0..1 scroll range

        const scrollOffset = scrollData ? scrollData.offset : 0;
        const angle = (elapsed * autoRotationSpeed) + (scrollOffset * scrollRotationSpeed);

        transToCenterRef.current.makeTranslation(-cx, -cy, -cz);
        rotMatrixRef.current.makeRotationZ(angle);
        transBackRef.current.makeTranslation(cx, cy, cz);

        localTransformRef.current.multiplyMatrices(transBackRef.current, rotMatrixRef.current);
        localTransformRef.current.multiply(transToCenterRef.current);

        groupRef.current.matrix.multiply(localTransformRef.current);

        // Force world matrix update so children (raycast box) have correct transforms
        groupRef.current.updateMatrixWorld(true);
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
        const inverseMatrix = new THREE.Matrix4().copy(groupRef.current!.matrix).invert();
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
      const impulseStr = settingsRef.current.scatterStrength * 0.08;

      // Auto-scale scatter params relative to model bounding box size
      // The original tuning assumed a ~8-unit model; scale proportionally
      const modelMaxDim = Math.max(boxSize[0], boxSize[1], boxSize[2]);
      const autoScale = Math.max(1, modelMaxDim / 8.0);
      const scaledRadius = scatterRadius * autoScale;
      const scaledRadius2 = scaledRadius * scaledRadius;
      const scaledImpulse = impulseStr * autoScale;

      const DAMPING = 0.85; // High friction so swipe velocity dies out quickly
      const EASE = 0.08; // Smooth ease-out return to rest position

      // Smoothly animate the target box size
      currentBoxSizeRef.current.lerp(new THREE.Vector3(boxSize[0], boxSize[1], boxSize[2]), 0.04);

      // Box half-extents for clamping using the animated size
      const hx = currentBoxSizeRef.current.x / 2;
      const hy = currentBoxSizeRef.current.y / 2;
      const hz = currentBoxSizeRef.current.z / 2;

      const bcx = boxCenter ? boxCenter[0] : 0;
      const bcy = boxCenter ? boxCenter[1] : 0;
      const bcz = boxCenter ? boxCenter[2] : 0;

      // Only apply impulse if mouse is moving (and not on the last model)
      const isSwiping = isHovering && pointerDelta > 0.001 && settings.currentModelIndex !== 2;
      const currentImpulseStr = settings.currentModelIndex === 2 ? 0.0 : scaledImpulse * (pointerDelta * 50.0); // Scale by swipe speed

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

          if (dist2 < scaledRadius2 && dist2 > 0.0001) {
            const dist = Math.sqrt(dist2);
            const pushFactor = (1.0 - dist / scaledRadius);

            // Softer falloff for wider visible effect
            const pushMag = Math.pow(pushFactor, 2.0) * currentImpulseStr * 3.0;

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

        // ── Damping (friction) kills the swipe momentum quickly ──
        vel[ix] *= DAMPING;
        vel[iy] *= DAMPING;
        vel[iz] *= DAMPING;

        // ── Update position with velocity ──
        let newX = px + vel[ix];
        let newY = py + vel[iy];
        let newZ = pz + vel[iz];

        // ── Pure Ease-Out back to rest (No elasticity/bounce) ──
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

      // Sync line segments group transform with the invisible raycast box
      if (boxLinesRef.current) {
        boxLinesRef.current.position.copy(boxRef.current.position);
        boxLinesRef.current.scale.copy(boxRef.current.scale);
      }
    }

    // Animate the XRay depth reveal for the body box (same approach as city)
    {
      const targetDepth = settings.xrayBorderRevealDepth ?? 40.0;
      const lerpSpeed = 1.0 - Math.exp(-state.clock.getDelta() / 0.2);
      boxAnimState.currentDepth += (targetDepth - boxAnimState.currentDepth) * lerpSpeed;
      boxLineMaterial.uniforms.uDepthLimit.value = boxAnimState.currentDepth;

      // Sync color/opacity from settings
      boxLineMaterial.uniforms.uColor.value.set(settings.xrayBorderColor || "#e91e63");
      boxLineMaterial.uniforms.uOpacity.value = settings.xrayBorderOpacity ?? 0.5;
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

      // Rotation: full 360° per cycle (scroll-driven) without continuous spin
      const angle = cycleProgress * Math.PI * 2;

      // Per-model upright correction offset
      groupRef.current.rotation.y = angle;
      groupRef.current.rotation.x = Math.sin(angle) * 0.12;
      groupRef.current.rotation.z = 0;

      // Z position: start far away (-8), come close (0) at mid-cycle, go back far
      const farDistance = -8;
      const closeDistance = 0;
      const zRange = farDistance - closeDistance;
      groupRef.current.position.z = closeDistance + ((1 + Math.cos(angle)) / 2) * zRange;
    } else if (groupRef.current && !meshes) {
      // No scroll context — static upright orientation (vertices are already upright)
      groupRef.current.rotation.set(0, 0, 0);
    }
  });

  if (centeredPositions.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {/* Postprocessing Stack */}
      <EffectComposer enableNormalPass={false} multisampling={0}>
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

      {/* Invisible box for raycasting (scatter interaction) */}
      {boxSize && (
        <mesh ref={boxRef}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* XRay depth-faded bounding box edges */}
      {boxSize && (
        <lineSegments ref={boxLinesRef}>
          <wireframeGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
          <primitive object={boxLineMaterial} attach="material" />
        </lineSegments>
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

      {/* Cloned Solid mesh and wireframe hologram transition */}
      {solidSceneCloned && (
        <group
          position={boxCenter ? [boxCenter[0], boxCenter[1], boxCenter[2]] : [0, 0, 0]}
          scale={[modelScale, modelScale, modelScale]}
        >
          <group position={cRotated ? [-cRotated[0], -cRotated[1], -cRotated[2]] : [0, 0, 0]}>
            <group quaternion={modelRotation || undefined}>
              <group position={cOriginal ? [-cOriginal[0], -cOriginal[1], -cOriginal[2]] : [0, 0, 0]}>
                <primitive object={solidSceneCloned} />
              </group>
            </group>
          </group>
        </group>
      )}
    </group>
  );
};

useGLTF.preload("/model.glb");
useGLTF.preload("/bird.glb");
useGLTF.preload("/figure.glb");
useGLTF.preload("/old_door.glb");
useGLTF.preload("/plane.glb");
useGLTF.preload("/myscene_v2.glb");

