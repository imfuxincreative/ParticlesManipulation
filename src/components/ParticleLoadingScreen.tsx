"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ModelParticleShader } from "@/shaders/modelShader";
import { useSimulation } from "@/context/SimulationContext";
import { SkyShader } from "@/shaders/skyShader";

// ─── Configuration ──────────────────────────────────────────────────
const LOADER_MODELS = ["/heart.glb", "/bird.glb"];
const CYCLE_INTERVAL_MS = 3000; // 3 seconds between model transitions
const PARTICLE_GRID = 90; // 192×192 = 36,864 particles
const PARTICLE_COUNT = PARTICLE_GRID * PARTICLE_GRID;
const TARGET_SIZE = 8.0; // Scaled to 8.0 on CPU to match ModelParticleSystem coordinates and prevent octopus distortion
const MORPH_FRAMES = 600; // ~10 seconds at 60fps — enough budget for slow morph speeds
const DAMPING = 0.88;
const EASE = 0.065;

// Per-model rotation corrections (degrees) to show them upright from front view
const ROTATION_OFFSETS: [number, number, number][] = [
  [0, 0, 0],     // heart.glb (already upright, face-on front view)
  [0, -90, 0],   // bird.glb (upright, slight side-angle front view)
];

// ─── Preload all loader models ──────────────────────────────────────
LOADER_MODELS.forEach((m) => useGLTF.preload(m));

function extractAndPrepare(
  gltf: any,
  modelIndex: number
): { positions: Float32Array; normals: Float32Array } {
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const tempPos = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();

  const sourceMeshes: THREE.Mesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((child: any) => {
    if (child instanceof THREE.Mesh) sourceMeshes.push(child);
  });

  // Surface vertices
  const surfacePositions: number[] = [];
  const surfaceColors: number[] = [];
  const surfaceNormals: number[] = [];

  for (const mesh of sourceMeshes) {
    const geometry = mesh.geometry;
    if (!geometry?.attributes.position) continue;

    const posAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    const worldMatrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    for (let i = 0; i < posAttr.count; i++) {
      tempPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      tempPos.applyMatrix4(worldMatrix);
      surfacePositions.push(tempPos.x, tempPos.y, tempPos.z);

      if (normalAttr) {
        tempNormal.set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
        tempNormal.applyMatrix3(normalMatrix).normalize();
        surfaceNormals.push(tempNormal.x, tempNormal.y, tempNormal.z);
      } else {
        surfaceNormals.push(0, 1, 0);
      }
    }
  }

  // Copy surface verts
  for (let i = 0; i < surfacePositions.length; i++) allPositions.push(surfacePositions[i]);
  for (let i = 0; i < surfaceNormals.length; i++) allNormals.push(surfaceNormals[i]);

  // Thickened shell (2 layers)
  const surfaceCount = surfacePositions.length / 3;
  if (surfaceCount > 0) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < surfacePositions.length; i += 3) {
      cx += surfacePositions[i];
      cy += surfacePositions[i + 1];
      cz += surfacePositions[i + 2];
    }
    cx /= surfaceCount;
    cy /= surfaceCount;
    cz /= surfaceCount;

    const LAYERS = 2;
    const MAX_INWARD = 0.12;

    for (let layer = 1; layer <= LAYERS; layer++) {
      const layerFrac = (layer / LAYERS) * MAX_INWARD;
      for (let i = 0; i < surfacePositions.length; i += 3) {
        const sx = surfacePositions[i], sy = surfacePositions[i + 1], sz = surfacePositions[i + 2];
        const dx = cx - sx, dy = cy - sy, dz = cz - sz;
        const t = layerFrac * (0.5 + Math.random() * 0.5);
        allPositions.push(sx + dx * t + (Math.random() - 0.5) * 0.005, sy + dy * t + (Math.random() - 0.5) * 0.005, sz + dz * t + (Math.random() - 0.5) * 0.005);
        allNormals.push(surfaceNormals[i], surfaceNormals[i + 1], surfaceNormals[i + 2]);
      }
    }
  }

  // Sample to fixed PARTICLE_COUNT
  const sourceCount = allPositions.length / 3;
  const sampledPos = new Float32Array(PARTICLE_COUNT * 3);
  const sampledNor = new Float32Array(PARTICLE_COUNT * 3);

  const step = sourceCount / PARTICLE_COUNT;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const srcIdx = Math.floor((i * step) % sourceCount) * 3;
    const jitter = PARTICLE_COUNT > sourceCount ? 0.005 : 0;
    sampledPos[i * 3] = allPositions[srcIdx] + (Math.random() - 0.5) * jitter;
    sampledPos[i * 3 + 1] = allPositions[srcIdx + 1] + (Math.random() - 0.5) * jitter;
    sampledPos[i * 3 + 2] = allPositions[srcIdx + 2] + (Math.random() - 0.5) * jitter;
    sampledNor[i * 3] = allNormals[srcIdx];
    sampledNor[i * 3 + 1] = allNormals[srcIdx + 1];
    sampledNor[i * 3 + 2] = allNormals[srcIdx + 2];
  }

  // Compute bounding box, apply rotation correction, centre, scale to TARGET_SIZE
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < sampledPos.length; i += 3) {
    minX = Math.min(minX, sampledPos[i]);
    minY = Math.min(minY, sampledPos[i + 1]);
    minZ = Math.min(minZ, sampledPos[i + 2]);
    maxX = Math.max(maxX, sampledPos[i]);
    maxY = Math.max(maxY, sampledPos[i + 1]);
    maxZ = Math.max(maxZ, sampledPos[i + 2]);
  }

  const ocx = (minX + maxX) / 2, ocy = (minY + maxY) / 2, ocz = (minZ + maxZ) / 2;

  // Apply per-model rotation offset
  const [rxDeg, ryDeg, rzDeg] = ROTATION_OFFSETS[modelIndex] ?? [0, 0, 0];
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rxDeg),
    THREE.MathUtils.degToRad(ryDeg),
    THREE.MathUtils.degToRad(rzDeg)
  );
  const quat = new THREE.Quaternion().setFromEuler(euler);
  const tv = new THREE.Vector3();
  const tn = new THREE.Vector3();

  for (let i = 0; i < sampledPos.length; i += 3) {
    tv.set(sampledPos[i] - ocx, sampledPos[i + 1] - ocy, sampledPos[i + 2] - ocz);
    tv.applyQuaternion(quat);
    sampledPos[i] = tv.x;
    sampledPos[i + 1] = tv.y;
    sampledPos[i + 2] = tv.z;
    tn.set(sampledNor[i], sampledNor[i + 1], sampledNor[i + 2]);
    tn.applyQuaternion(quat).normalize();
    sampledNor[i] = tn.x;
    sampledNor[i + 1] = tn.y;
    sampledNor[i + 2] = tn.z;
  }

  // Re-centre after rotation
  let rMinX = Infinity, rMinY = Infinity, rMinZ = Infinity;
  let rMaxX = -Infinity, rMaxY = -Infinity, rMaxZ = -Infinity;
  for (let i = 0; i < sampledPos.length; i += 3) {
    rMinX = Math.min(rMinX, sampledPos[i]);
    rMinY = Math.min(rMinY, sampledPos[i + 1]);
    rMinZ = Math.min(rMinZ, sampledPos[i + 2]);
    rMaxX = Math.max(rMaxX, sampledPos[i]);
    rMaxY = Math.max(rMaxY, sampledPos[i + 1]);
    rMaxZ = Math.max(rMaxZ, sampledPos[i + 2]);
  }

  const rcx = (rMinX + rMaxX) / 2, rcy = (rMinY + rMaxY) / 2, rcz = (rMinZ + rMaxZ) / 2;
  for (let i = 0; i < sampledPos.length; i += 3) {
    sampledPos[i] -= rcx;
    sampledPos[i + 1] -= rcy;
    sampledPos[i + 2] -= rcz;
  }

  // Scale to TARGET_SIZE
  const sizeX = rMaxX - rMinX, sizeY = rMaxY - rMinY, sizeZ = rMaxZ - rMinZ;
  const maxDim = Math.max(sizeX, sizeY, sizeZ);
  const scale = maxDim > 0 ? TARGET_SIZE / maxDim : 1;
  for (let i = 0; i < sampledPos.length; i += 3) {
    sampledPos[i] *= scale;
    sampledPos[i + 1] *= scale;
    sampledPos[i + 2] *= scale;
  }

  return { positions: sampledPos, normals: sampledNor };
}

// ═════════════════════════════════════════════════════════════════════
// LoaderSkyDome — Simplified sky dome for the loading screen (no SCENE.glb or ScrollControls dependency)
const LoaderSkyDome: React.FC<{
  settings: LoaderParticleSystemProps["settings"];
}> = ({ settings }) => {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => {
    return THREE.UniformsUtils.clone(SkyShader.uniforms);
  }, []);

  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uHorizonColor.value.set(settings.skyColor || "#ff007f");
    u.uExposure.value = settings.skyExposure ?? 1.55;
    if (u.uHorizonMin) {
      u.uHorizonMin.value = settings.skyHorizonRange ?? 0.0;
    }
  }, [settings.skyColor, settings.skyExposure, settings.skyHorizonRange]);

  useFrame(() => {
    if (meshRef.current && camera) {
      camera.getWorldPosition(meshRef.current.position);
      camera.getWorldQuaternion(meshRef.current.quaternion);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[800, 32, 15]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={SkyShader.vertexShader}
        fragmentShader={SkyShader.fragmentShader}
        uniforms={uniforms}
        transparent={false}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

// LoaderParticleSystem — inner R3F component (reads SimulationContext)
// ═════════════════════════════════════════════════════════════════════
interface LoaderParticleSystemProps {
  settings: ReturnType<typeof useSimulation>["settings"];
  isExiting: boolean;
  onReady: () => void;
}

const LoaderParticleSystem: React.FC<LoaderParticleSystemProps> = ({ settings, isExiting, onReady }) => {
  const [modelIndex, setModelIndex] = useState(0);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  // Load ALL models upfront statically (strictly compliant with Rules of Hooks)
  const gltf0 = useGLTF(LOADER_MODELS[0]);
  const gltf1 = useGLTF(LOADER_MODELS[1]);
  const gltfs = useMemo(() => [gltf0, gltf1], [gltf0, gltf1]);

  // Extract vertex data for every model once
  const allModelData = useMemo(() => {
    return gltfs.map((g, idx) => extractAndPrepare(g, idx));
  }, [gltfs]);

  // Physics state refs
  const restPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const dynamicPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const scatterAmountsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT));

  const restNormalsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const dynamicNormalsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));

  const framesToSimRef = useRef(MORPH_FRAMES);
  const physicsReady = useRef(false);

  // 3-second cycling timer
  useEffect(() => {
    const id = setInterval(() => {
      setModelIndex((prev) => (prev + 1) % LOADER_MODELS.length);
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Single unified hook for transitions & initializations to prevent jumping
  useEffect(() => {
    const data = allModelData[modelIndex];
    if (!data) return;

    restPositionsRef.current = new Float32Array(data.positions);
    restNormalsRef.current = new Float32Array(data.normals);

    if (!physicsReady.current) {
      // First time initialization: snap directly to values
      dynamicPositionsRef.current = new Float32Array(data.positions);
      dynamicNormalsRef.current = new Float32Array(data.normals);

      velocitiesRef.current = new Float32Array(PARTICLE_COUNT * 3).fill(0);
      scatterAmountsRef.current = new Float32Array(PARTICLE_COUNT).fill(0);
      physicsReady.current = true;
      framesToSimRef.current = MORPH_FRAMES;
    } else {
      // Morphing transition: do NOT reset dynamic arrays, just trigger simulation
      framesToSimRef.current = MORPH_FRAMES;
    }
  }, [modelIndex, allModelData]);

  // Uniforms — initialised from settings, synced reactively
  const uniforms = useMemo(() => ({
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
    uClipY: { value: -100.0 },
    uClipSide: { value: 0.0 },
    uFlowStrength: { value: settings.modelFlowStrength },
    uFlowSpeed: { value: settings.modelFlowSpeed },
    uFlowFrequency: { value: settings.modelFlowFrequency },
    uFlowNormalLimit: { value: settings.modelFlowNormalLimit },
    uFlowClumping: { value: settings.modelFlowClumping },
    uGlowIntensity: { value: 1.0 },
    uScrollProgress: { value: 0.0 },
    uShowFog: { value: settings.showFog ? 1.0 : 0.0 },
    uFogColor: { value: new THREE.Color(settings.fogColor) },
    uFogNear: { value: settings.fogNear },
    uFogFar: { value: settings.fogFar },
    uFogAmount: { value: settings.fogAmount },
    uScatterColorScale: { value: settings.modelScatterColorScale },
  }), []);

  useEffect(() => {
    onReady();
  }, [onReady]);

  // Sync uniforms reactively with dashboard settings (mirrors ModelParticleSystem)
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
    if (u.uGlowIntensity) u.uGlowIntensity.value = 1.0;

    if (u.uShowFog) u.uShowFog.value = settings.showFog ? 1.0 : 0.0;
    if (u.uFogColor) u.uFogColor.value.set(settings.fogColor);
    if (u.uFogNear) u.uFogNear.value = settings.fogNear;
    if (u.uFogFar) u.uFogFar.value = settings.fogFar;
    if (u.uFogAmount) u.uFogAmount.value = settings.fogAmount;

    if (u.uFlowStrength) u.uFlowStrength.value = settings.modelFlowStrength;
    if (u.uFlowSpeed) u.uFlowSpeed.value = settings.modelFlowSpeed;
    if (u.uFlowFrequency) u.uFlowFrequency.value = settings.modelFlowFrequency;
    if (u.uFlowNormalLimit) u.uFlowNormalLimit.value = settings.modelFlowNormalLimit;
    if (u.uFlowClumping) u.uFlowClumping.value = settings.modelFlowClumping;
    if (u.uScatterColorScale) u.uScatterColorScale.value = settings.modelScatterColorScale;
  }, [settings]);

  // Animation loop
  useFrame((state) => {
    if (!physicsReady.current || !pointsRef.current) return;

    const elapsed = state.clock.elapsedTime;

    // Update time + aspect uniforms each frame
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = elapsed;
      materialRef.current.uniforms.uAspect.value = state.viewport.aspect;
      materialRef.current.uniforms.uParticleOpacity.value = 1.0;
    }

    // Radial explosive scatter transition when loading finishes
    if (isExiting) {
      const pos = dynamicPositionsRef.current;
      const scatter = scatterAmountsRef.current;
      const vel = velocitiesRef.current;
      const count = PARTICLE_COUNT;

      for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;
        const px = pos[ix], py = pos[iy], pz = pos[iz];
        const dist = Math.sqrt(px * px + py * py + pz * pz) + 0.001;

        const dx = px / dist;
        const dy = py / dist;

        vel[ix] += dx * 0.14 + (Math.random() - 0.5) * 0.04;
        vel[iy] += dy * 0.14 + (Math.random() - 0.5) * 0.04;
        vel[iz] = 0.0; // Prevent depth scattering (towards/away from camera)

        pos[ix] += vel[ix];
        pos[iy] += vel[iy];
        // pos[iz] remains unchanged to prevent flying forward into camera

        scatter[i] = 1.0;
      }

      const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;

      const scatterAttr = pointsRef.current.geometry.attributes.aScatter as THREE.BufferAttribute;
      if (scatterAttr) scatterAttr.needsUpdate = true;

      if (materialRef.current) {
        materialRef.current.uniforms.uScatterColorScale.value = 5.0;
      }
      return;
    }

    // Feed burn sensitivity into uScatterColorScale so the shader
    // maps particle speed (stored in aScatter) to the primary burn color.
    if (materialRef.current) {
      const sensitivity = settings.loaderBurnSensitivity ?? 2.0;
      materialRef.current.uniforms.uScatterColorScale.value = sensitivity;
      materialRef.current.uniforms.uBurnProgress.value = 0.0;
    }

    // CPU physics morph (runs when transitioning between models)
    if (framesToSimRef.current > 0) {
      const rest = restPositionsRef.current;
      const pos = dynamicPositionsRef.current;
      const vel = velocitiesRef.current;
      const scatter = scatterAmountsRef.current;

      const restNormals = restNormalsRef.current;
      const dynamicNormals = dynamicNormalsRef.current;

      const count = PARTICLE_COUNT;
      const morphEase = settings.loaderMorphSpeed ?? 0.02;

      for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;

        vel[ix] *= DAMPING;
        vel[iy] *= DAMPING;
        vel[iz] *= DAMPING;

        let nx = pos[ix] + vel[ix];
        let ny = pos[iy] + vel[iy];
        let nz = pos[iz] + vel[iz];

        nx += (rest[ix] - nx) * morphEase;
        ny += (rest[iy] - ny) * morphEase;
        nz += (rest[iz] - nz) * morphEase;

        // Calculate velocity this frame
        const vx = nx - pos[ix];
        const vy = ny - pos[iy];
        const vz = nz - pos[iz];

        pos[ix] = nx;
        pos[iy] = ny;
        pos[iz] = nz;

        // Smoothly morph normals
        dynamicNormals[ix] += (restNormals[ix] - dynamicNormals[ix]) * morphEase;
        dynamicNormals[iy] += (restNormals[iy] - dynamicNormals[iy]) * morphEase;
        dynamicNormals[iz] += (restNormals[iz] - dynamicNormals[iz]) * morphEase;

        // Store velocity magnitude
        const speedSq = vx * vx + vy * vy + vz * vz;
        scatter[i] = speedSq > 0.000001 ? Math.sqrt(speedSq) : 0.0;
      }

      const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;

      const norAttr = pointsRef.current.geometry.attributes.aNormal as THREE.BufferAttribute;
      if (norAttr) norAttr.needsUpdate = true;

      const scatterAttr = pointsRef.current.geometry.attributes.aScatter as THREE.BufferAttribute;
      if (scatterAttr) scatterAttr.needsUpdate = true;

      framesToSimRef.current--;

      // Snap to rest when budget ends
      if (framesToSimRef.current === 0) {
        pos.set(rest);
        dynamicNormals.set(restNormals);
        vel.fill(0);
        scatter.fill(0);

        if (posAttr) posAttr.needsUpdate = true;
        if (norAttr) norAttr.needsUpdate = true;
        if (scatterAttr) scatterAttr.needsUpdate = true;
      }
    }
  });

  const scaleVal = settings.loaderModelScale ?? 0.12;

  return (
    <>
      {/* Post-processing */}
      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom mipmapBlur intensity={settings.simonBloomIntensity} luminanceThreshold={1.1} luminanceSmoothing={0.1} />
      </EffectComposer>

      {/* Particle cloud */}
      <points ref={pointsRef} scale={[scaleVal, scaleVal, scaleVal]} frustumCulled={false}>
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
            args={[new Float32Array(PARTICLE_COUNT * 3).fill(-1), 3]}
          />
          <bufferAttribute
            attach="attributes-aNormal"
            args={[dynamicNormalsRef.current, 3]}
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
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════
// HUD Overlay Status Messages (cycle through tech-style messages)
// ═════════════════════════════════════════════════════════════════════
const STATUS_MESSAGES = [
  "Initializing particle subsystem…",
  "Sampling vertex manifold…",
  "Computing curl-noise displacement field…",
  "Syncing shader pipeline…",
  "Establishing morph targets…",
  "Calibrating bloom coefficients…",
  "Loading volumetric data…",
];

const AnimatedStatus: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="inline-block"
      style={{ animation: "loaderFadeInOut 2.2s ease-in-out infinite" }}
    >
      {STATUS_MESSAGES[msgIndex]}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ParticleLoadingScreen — exported overlay component
// ═════════════════════════════════════════════════════════════════════
export const ParticleLoadingScreen: React.FC = () => {
  const { settings, updateSetting, triggerSceneEntrance } = useSimulation();
  const [dots, setDots] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loaderReady, setLoaderReady] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const displayProgressRef = useRef(0);

  // Smooth monotonic progress: only increases, never jumps back
  useEffect(() => {
    const rawProgress = settings.sceneLoadProgress || 0;
    let animId: number;

    const animate = () => {
      const current = displayProgressRef.current;
      // Target is the max of raw progress and current display (never decrease)
      const target = Math.max(current, rawProgress);
      // Smooth lerp towards target
      const next = current + (target - current) * 0.08;
      // Snap when close enough
      const snapped = Math.abs(next - target) < 0.5 ? target : next;

      if (snapped !== current) {
        displayProgressRef.current = snapped;
        setDisplayProgress(snapped);
      }

      if (snapped < 100) {
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [settings.sceneLoadProgress]);

  const startExitTransition = () => {
    if (isExiting) return;
    setIsExiting(true);
    triggerSceneEntrance();

    setTimeout(() => {
      setHidden(true);
      updateSetting("isLoading", false);
    }, 1400);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (settings.alwaysShowLoader) {
      setIsExiting(false);
      setHidden(false);
      updateSetting("isLoading", true);
      return;
    }

    // Trigger exit transition ONLY once the 3D scene GLTFs are 100% loaded into GPU memory
    if (settings.isSceneLoaded && !isExiting) {
      startExitTransition();
    }
  }, [settings.alwaysShowLoader, settings.isSceneLoaded, isExiting]);

  if (hidden && !settings.alwaysShowLoader) return null;

  const borderColor = settings.xrayBorderColor

  return (
    <div
      id="particle-loading-screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden font-sans transition-[opacity,background] duration-[1200ms] ease-in-out ${isExiting ? "bg-black opacity-0 pointer-events-none" : "bg-white opacity-100 pointer-events-auto"
        }`}
    >
      {/* Smoothly fade in entire loading system content from white background */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-[1800ms] ease-out ${loaderReady ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
      >
        {/* Inject keyframes */}
        <style>{`
        @keyframes loaderFadeInOut {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0); }
          85%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes loaderPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1.0; }
        }
        @keyframes loaderBarSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

        {/* Interactive Control Button: Always Show Loader */}
        {/* <div className="absolute top-6 right-6 z-[100] pointer-events-auto">
          <button
            onClick={() => {
              const nextVal = !settings.alwaysShowLoader;
              updateSetting("alwaysShowLoader", nextVal);
              if (!nextVal && settings.isSceneLoaded) {
                startExitTransition();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-[20px] text-[11px] font-semibold tracking-[0.05em] text-white cursor-pointer backdrop-blur-xl transition-all duration-200 ease-in-out ${settings.alwaysShowLoader
              ? "bg-purple-500/30 border border-purple-500/70 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              : "bg-slate-900/80 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full inline-block ${settings.alwaysShowLoader
                ? "bg-purple-400 shadow-[0_0_8px_#a855f7]"
                : "bg-slate-500"
                }`}
            />
            ALWAYS SHOW LOADER: {settings.alwaysShowLoader ? "ON" : "OFF"}
          </button>
        </div> */}

        {/* Fullscreen R3F Canvas */}
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 6], fov: 50, near: 0.1, far: 2000 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NoToneMapping;
              gl.outputColorSpace = THREE.SRGBColorSpace;
            }}
          >
            <color attach="background" args={["#ffffff"]} />

            <React.Suspense fallback={null}>
              {settings.showSky && <LoaderSkyDome settings={settings} />}
              <LoaderParticleSystem settings={settings} isExiting={isExiting} onReady={() => setLoaderReady(true)} />
            </React.Suspense>
          </Canvas>
        </div>


        {/* bottom-right */}



        {/* Loading text at bottom */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-[1]">
          {/* Title */}
          {/* <div className="text-[#dadada] text-[12px]  tracking-[0.05em]">
            {Math.round(displayProgress)}%
          </div> */}
          {/* <div className="text-[#dadada] text-[12px]  tracking-[0.05em]">Loading</div> */}
          {/* Dynamic Progress bar synced to Drei asset loader */}
          <div className="w-[220px] h-[3px] bg-[#ededed] overflow-hidden relative">
            <div
              className="absolute top-0 left-0 bottom-0 rounded transition-[width] opacity-75 duration-500 ease-out"
              style={{
                width: `${Math.max(2, displayProgress)}%`,
                background: borderColor,

              }}
            />
          </div>

          {/* Animated status message */}
          {/* <div className="text-slate-400/70 text-[11px] font-normal tracking-[0.02em] h-4 overflow-hidden">
            <AnimatedStatus />
          </div> */}
        </div>

        {/* Bottom version label */}

      </div>
    </div>
  );
};
