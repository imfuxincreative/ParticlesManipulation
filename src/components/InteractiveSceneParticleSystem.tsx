"use client";

import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { ModelParticleShader } from "@/shaders/modelShader";
import { useSimulation } from "@/context/SimulationContext";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";
import { INTERACTIVE_MODELS, MODEL_NAMES } from "@/config/projectModels";
import { particleSoundEngine } from "@/lib/audio/ParticleSoundEngine";

const PARTICLE_GRID = 90;
const PARTICLE_COUNT = PARTICLE_GRID * PARTICLE_GRID;
const TARGET_SIZE = 6.0;
const MORPH_FRAMES = 600;

const HASH_SIZE = 4096;
const MAX_ACTIVE = 2500;

const ROTATION_OFFSETS: [number, number, number][] = [
  [0, -90, 0], // Heart
  [0, -90, 0], // Bird
];

INTERACTIVE_MODELS.forEach((m) => useGLTF.preload(m));

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

  const surfacePositions: number[] = [];
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

  for (let i = 0; i < surfacePositions.length; i++) allPositions.push(surfacePositions[i]);
  for (let i = 0; i < surfaceNormals.length; i++) allNormals.push(surfaceNormals[i]);

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
        allPositions.push(
          sx + dx * t + (Math.random() - 0.5) * 0.005,
          sy + dy * t + (Math.random() - 0.5) * 0.005,
          sz + dz * t + (Math.random() - 0.5) * 0.005
        );
        allNormals.push(surfaceNormals[i], surfaceNormals[i + 1], surfaceNormals[i + 2]);
      }
    }
  }

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

  const [rxDeg, ryDeg, rzDeg] = ROTATION_OFFSETS[modelIndex] ?? [0, -90, 0];
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

export interface InteractiveSceneParticleSystemProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export const InteractiveSceneParticleSystem: React.FC<InteractiveSceneParticleSystemProps> = ({
  position = [1047.551, 398.157, 2.997],
  rotation = [-Math.PI / 2, -Math.PI / 2, 1.5]
}) => {
  const { settings, updateSetting } = useSimulation();
  const modelIndex = (settings.currentModelIndex ?? 0) % INTERACTIVE_MODELS.length;
  const { camera, raycaster } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const gltf0 = useGLTF(INTERACTIVE_MODELS[0]);
  const gltf1 = useGLTF(INTERACTIVE_MODELS[1]);
  const gltfs = useMemo(() => [gltf0, gltf1], [gltf0, gltf1]);

  const allModelData = useMemo(() => {
    return gltfs.map((g, idx) => extractAndPrepare(g, idx));
  }, [gltfs]);

  const restPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const dynamicPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const scatterAmountsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT));

  const restNormalsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const dynamicNormalsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));

  const framesToSimRef = useRef(MORPH_FRAMES);
  const physicsReady = useRef(false);

  const isHoveredRef = useRef(false);
  const lastPointerPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const pointerVelocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentPointerLocalRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());

  // Spatial hash grid preallocated buffers for active particle collision detection
  const gridHeadsRef = useRef<Int32Array>(new Int32Array(HASH_SIZE).fill(-1));
  const gridNextRef = useRef<Int32Array>(new Int32Array(MAX_ACTIVE));
  const activeIndicesRef = useRef<Int32Array>(new Int32Array(MAX_ACTIVE));

  // Audio synchronization refs (read-only motion signals)
  const prevMotionEnergyRef = useRef(0.0);
  const audioCentroidRef = useRef(new THREE.Vector3());
  const audioModelPosRef = useRef(new THREE.Vector3());
  const audioCamPosRef = useRef(new THREE.Vector3());

  // Sync simulation audio settings with procedural sound engine
  useEffect(() => {
    particleSoundEngine.updateSettings({
      enabled: settings.particleSoundEnabled,
      volume: settings.particleSoundVolume,
      ambientVolume: settings.particleAmbientVolume ?? settings.particleIdleVolume ?? 0.075,
      preset: settings.particleSoundPreset,
      pitch: settings.particleSoundPitch,
      shimmer: settings.particleSoundShimmer,
      sensitivity: settings.particleMotionSensitivity ?? settings.particleCollisionSensitivity ?? 0.2,
      onsetStrength: settings.particleOnsetStrength ?? 0.0,
      nearDistance: settings.particleAudioNearDistance ?? 25.0,
      farDistance: settings.particleAudioFarDistance ?? 120.0,
      tactileTexture: settings.particleTactileTexture ?? 0.25,
      tactilePitch: settings.particleTactilePitch ?? 2200,
      tactileResonance: settings.particleTactileResonance ?? 4.5,
      tactileSnap: settings.particleTactileSnap ?? 0.85,
    });
  }, [
    settings.particleSoundEnabled,
    settings.particleSoundVolume,
    settings.particleAmbientVolume,
    settings.particleIdleVolume,
    settings.particleSoundPreset,
    settings.particleSoundPitch,
    settings.particleSoundShimmer,
    settings.particleMotionSensitivity,
    settings.particleCollisionSensitivity,
    settings.particleOnsetStrength,
    settings.particleAudioNearDistance,
    settings.particleAudioFarDistance,
    settings.particleTactileTexture,
    settings.particleTactilePitch,
    settings.particleTactileResonance,
    settings.particleTactileSnap,
  ]);

  const handleNextModel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (modelIndex + 1) % INTERACTIVE_MODELS.length;
    updateSetting("currentModelIndex", nextIdx);
  }, [modelIndex, updateSetting]);

  const handlePrevModel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIdx = (modelIndex - 1 + INTERACTIVE_MODELS.length) % INTERACTIVE_MODELS.length;
    updateSetting("currentModelIndex", prevIdx);
  }, [modelIndex, updateSetting]);

  useEffect(() => {
    const data = allModelData[modelIndex];
    if (!data) return;

    restPositionsRef.current = new Float32Array(data.positions);
    restNormalsRef.current = new Float32Array(data.normals);

    if (!physicsReady.current) {
      dynamicPositionsRef.current = new Float32Array(data.positions);
      dynamicNormalsRef.current = new Float32Array(data.normals);
      velocitiesRef.current = new Float32Array(PARTICLE_COUNT * 3).fill(0);
      scatterAmountsRef.current = new Float32Array(PARTICLE_COUNT).fill(0);
      physicsReady.current = true;
      framesToSimRef.current = MORPH_FRAMES;
    } else {
      framesToSimRef.current = MORPH_FRAMES;
    }
  }, [modelIndex, allModelData]);

  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    // If mouse button is held down (e.g. dragging camera/scene), do not animate
    const isMouseDrag = e.pointerType === "mouse" && (e.buttons > 0 || (e.nativeEvent && (e.nativeEvent as PointerEvent).buttons > 0));
    if (isMouseDrag) {
      isHoveredRef.current = false;
      return;
    }

    if (!groupRef.current) return;

    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir.negate(), worldPos);

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlaneRef.current, intersection);
    if (intersection) {
      groupRef.current.worldToLocal(intersection);
      lastPointerPosRef.current.copy(intersection);
      currentPointerLocalRef.current.copy(intersection);
      pointerVelocityRef.current.set(0, 0, 0);
      isHoveredRef.current = true;
    }
  }, [camera, raycaster]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    // If dragging with mouse button pressed, do not animate on drag
    const isMouseDrag = e.pointerType === "mouse" && (e.buttons > 0 || (e.nativeEvent && (e.nativeEvent as PointerEvent).buttons > 0));
    if (isMouseDrag) {
      isHoveredRef.current = false;
      pointerVelocityRef.current.set(0, 0, 0);
      return;
    }

    if (!groupRef.current) return;

    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir.negate(), worldPos);

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlaneRef.current, intersection);

    if (intersection) {
      groupRef.current.worldToLocal(intersection);

      if (!isHoveredRef.current) {
        lastPointerPosRef.current.copy(intersection);
        currentPointerLocalRef.current.copy(intersection);
        pointerVelocityRef.current.set(0, 0, 0);
        isHoveredRef.current = true;
      } else {
        pointerVelocityRef.current.subVectors(intersection, lastPointerPosRef.current);
        pointerVelocityRef.current.clampLength(0, 2.5);
        lastPointerPosRef.current.copy(intersection);
        currentPointerLocalRef.current.copy(intersection);
      }
    }
  }, [camera, raycaster]);

  const handlePointerLeave = useCallback(() => {
    isHoveredRef.current = false;
    pointerVelocityRef.current.set(0, 0, 0);
  }, []);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    // On mouse click/drag, cancel hover animation so dragging doesn't trigger particle motion
    if (e.pointerType === "mouse") {
      isHoveredRef.current = false;
      pointerVelocityRef.current.set(0, 0, 0);
    }
  }, []);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir.negate(), worldPos);

      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlaneRef.current, intersection);
      if (intersection) {
        groupRef.current.worldToLocal(intersection);
        lastPointerPosRef.current.copy(intersection);
        currentPointerLocalRef.current.copy(intersection);
        pointerVelocityRef.current.set(0, 0, 0);
        isHoveredRef.current = true;
      }
    }
  }, [camera, raycaster]);

  useEffect(() => {
    const onBlurOrLeave = () => {
      isHoveredRef.current = false;
      pointerVelocityRef.current.set(0, 0, 0);
    };
    window.addEventListener("blur", onBlurOrLeave);
    document.addEventListener("mouseleave", onBlurOrLeave);
    return () => {
      window.removeEventListener("blur", onBlurOrLeave);
      document.removeEventListener("mouseleave", onBlurOrLeave);
    };
  }, []);

  const uniforms = useMemo(() => ({
    uNoiseStrength: { value: settings.noiseStrength },
    uNoiseSpeed: { value: settings.noiseSpeed },
    uPointSize: { value: settings.pointSize * 1.5 },
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
    uFlowStrength: { value: settings.modelFlowStrength * 1.5 },
    uFlowSpeed: { value: settings.modelFlowSpeed },
    uFlowFrequency: { value: settings.modelFlowFrequency },
    uFlowNormalLimit: { value: settings.modelFlowNormalLimit },
    uFlowClumping: { value: settings.modelFlowClumping },
    uGlowIntensity: { value: 1.2 },
    uScrollProgress: { value: 0.0 },
    uScatterColorScale: { value: 2.5 },
    uSpiralSuppression: { value: settings.fluidSpiralSuppression ?? 1.0 },
    uBurnColorPrimary: { value: new THREE.Color(settings.burnColorPrimary || "#e91e63") },
    uBurnColorSecondary: { value: new THREE.Color(settings.burnColorSecondary || "#00ffff") },
    uBurnSensitivity: { value: settings.burnSensitivity ?? 2.5 },
    uBurnThreshold: { value: settings.burnThreshold ?? 0.05 },
    uBurnExponent: { value: settings.burnExponent ?? 1.5 },
    uBurnMidThreshold: { value: settings.burnMidThreshold ?? 0.25 },
    uBurnMaxThreshold: { value: settings.burnMaxThreshold ?? 0.70 },
    ...atmosphereUniforms,
  }), []);

  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uNoiseStrength.value = settings.noiseStrength;
    u.uNoiseSpeed.value = settings.noiseSpeed;
    u.uPointSize.value = settings.pointSize * 1.5;
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
    if (u.uFlowStrength) u.uFlowStrength.value = settings.modelFlowStrength * 1.5;
    if (u.uFlowSpeed) u.uFlowSpeed.value = settings.modelFlowSpeed;
    if (u.uFlowFrequency) u.uFlowFrequency.value = settings.modelFlowFrequency;
    if (u.uFlowNormalLimit) u.uFlowNormalLimit.value = settings.modelFlowNormalLimit;
    if (u.uFlowClumping) u.uFlowClumping.value = settings.modelFlowClumping;
    if (u.uScatterColorScale) u.uScatterColorScale.value = settings.modelScatterColorScale;
    if (u.uSpiralSuppression) u.uSpiralSuppression.value = settings.fluidSpiralSuppression ?? 1.0;
    if (u.uBurnColorPrimary) u.uBurnColorPrimary.value.set(settings.burnColorPrimary || "#e91e63");
    if (u.uBurnColorSecondary) u.uBurnColorSecondary.value.set(settings.burnColorSecondary || "#00ffff");
    if (u.uBurnSensitivity) u.uBurnSensitivity.value = settings.burnSensitivity ?? 2.5;
    if (u.uBurnThreshold) u.uBurnThreshold.value = settings.burnThreshold ?? 0.05;
    if (u.uBurnExponent) u.uBurnExponent.value = settings.burnExponent ?? 1.5;
    if (u.uBurnMidThreshold) u.uBurnMidThreshold.value = settings.burnMidThreshold ?? 0.25;
    if (u.uBurnMaxThreshold) u.uBurnMaxThreshold.value = settings.burnMaxThreshold ?? 0.70;
  }, [settings]);

  const targetMeshRef = useRef<THREE.Object3D | null>(null);
  const tempWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // --- PERF: Resolve target mesh once instead of searching scene graph every frame ---
  useEffect(() => {
    // Defer to next frame so the scene graph is fully mounted
    const id = requestAnimationFrame(() => {
      const found = groupRef.current?.parent
        ? (function findInScene(obj: THREE.Object3D): THREE.Object3D | null {
          let root: THREE.Object3D = obj;
          while (root.parent) root = root.parent;
          return root.getObjectByName("Cube005") || root.getObjectByName("Cube.005") || null;
        })(groupRef.current)
        : null;
      if (found) {
        found.visible = false;
        targetMeshRef.current = found;
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    if (groupRef.current) {
      if (targetMeshRef.current) {
        targetMeshRef.current.visible = false;
        targetMeshRef.current.getWorldPosition(tempWorldPosRef.current);
      } else {
        tempWorldPosRef.current.set(position[0], position[1], position[2]);
      }

      groupRef.current.position.set(
        tempWorldPosRef.current.x + (settings.modelOffsetX ?? 0),
        tempWorldPosRef.current.y + (settings.modelOffsetY ?? 0),
        tempWorldPosRef.current.z + (settings.modelOffsetZ ?? 0)
      );

      const scaleVal = settings.modelScale ?? 1.0;
      groupRef.current.scale.set(scaleVal, scaleVal, scaleVal);

      const baseRotX = rotation ? rotation[0] : (settings.modelBaseRotationX ?? -Math.PI / 2);
      const baseRotY = rotation ? rotation[1] : (settings.modelBaseRotationY ?? 0);
      const baseRotZ = rotation ? rotation[2] : (settings.modelBaseRotationZ ?? 1.5);
      const autoSpeedX = settings.modelAutoRotateSpeedX ?? 0.3;

      // Fixed base orientation + horizontal turntable spin around the vertical (Y) axis
      const qBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(baseRotX, baseRotY, baseRotZ, "XYZ"));
      const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), elapsed * autoSpeedX);
      groupRef.current.quaternion.copy(qSpin.multiply(qBase));
    }

    if (!physicsReady.current || !pointsRef.current) return;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = elapsed;
      materialRef.current.uniforms.uAspect.value = state.viewport.aspect;
    }

    const rest = restPositionsRef.current;
    const pos = dynamicPositionsRef.current;
    const vel = velocitiesRef.current;
    const scatter = scatterAmountsRef.current;

    const restNormals = restNormalsRef.current;
    const dynamicNormals = dynamicNormalsRef.current;

    const count = PARTICLE_COUNT;
    const morphEase = settings.loaderMorphSpeed ?? 0.025;
    const damping = settings.fluidDamping ?? 0.88;

    const isHovered = isHoveredRef.current;
    const pLoc = currentPointerLocalRef.current;
    const pVel = pointerVelocityRef.current;
    const pSpeed = pVel.length();

    const FLUID_RADIUS = settings.fluidDragRadius ?? 4.0;
    const FLUID_RADIUS_SQ = FLUID_RADIUS * FLUID_RADIUS;
    const dragStrength = settings.fluidDragStrength ?? 1.2;

    // Read-only scatter accumulators for motion sound engine (zero visual side-effects)
    let sumSpeed = 0;
    let activeN = 0;
    let cx = 0, cy = 0, cz = 0;

    for (let i = 0; i < count; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2;

      if (isHovered && pSpeed > 0.001) {
        const dx = pos[ix] - pLoc.x;
        const dy = pos[iy] - pLoc.y;
        const dz = pos[iz] - pLoc.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < FLUID_RADIUS_SQ) {
          const dist = Math.sqrt(distSq);
          const falloff = 1.0 - dist / FLUID_RADIUS;
          const fluidFactor = falloff * falloff * 0.9 * dragStrength;

          const invDist = 1.0 / (dist + 0.0001);
          const radX = dx * invDist;
          const radY = dy * invDist;
          const radZ = dz * invDist;

          const swirlX = -pVel.y * radZ + pVel.z * radY;
          const swirlY = pVel.x * radZ - pVel.z * radX;
          const swirlZ = -pVel.x * radY + pVel.y * radX;

          const dragImpulse = settings.fluidDirectionalBias ?? 0.40;
          const radialImpulse = settings.fluidRadialExpansion ?? 0.45;
          const swirlImpulse = settings.fluidTurbulenceSwirl ?? 0.35;

          const impulseX = pVel.x * dragImpulse + radX * radialImpulse * (pSpeed * 1.5 + 0.05) + swirlX * swirlImpulse;
          const impulseY = pVel.y * dragImpulse + radY * radialImpulse * (pSpeed * 1.5 + 0.05) + swirlY * swirlImpulse;
          const impulseZ = pVel.z * dragImpulse + radZ * radialImpulse * (pSpeed * 1.5 + 0.05) + swirlZ * swirlImpulse;

          vel[ix] += impulseX * fluidFactor + (Math.random() - 0.5) * 0.04 * falloff;
          vel[iy] += impulseY * fluidFactor + (Math.random() - 0.5) * 0.04 * falloff;
          vel[iz] += impulseZ * fluidFactor + (Math.random() - 0.5) * 0.04 * falloff;
        }
      }

      vel[ix] *= damping;
      vel[iy] *= damping;
      vel[iz] *= damping;

      let nx = pos[ix] + vel[ix];
      let ny = pos[iy] + vel[iy];
      let nz = pos[iz] + vel[iz];

      nx += (rest[ix] - nx) * morphEase;
      ny += (rest[iy] - ny) * morphEase;
      nz += (rest[iz] - nz) * morphEase;

      const vx = nx - pos[ix];
      const vy = ny - pos[iy];
      const vz = nz - pos[iz];

      pos[ix] = nx;
      pos[iy] = ny;
      pos[iz] = nz;

      dynamicNormals[ix] += (restNormals[ix] - dynamicNormals[ix]) * morphEase;
      dynamicNormals[iy] += (restNormals[iy] - dynamicNormals[iy]) * morphEase;
      dynamicNormals[iz] += (restNormals[iz] - dynamicNormals[iz]) * morphEase;

      const speedSq = vx * vx + vy * vy + vz * vz;
      const s = speedSq > 0.000001 ? Math.sqrt(speedSq) : 0.0;
      scatter[i] = s;

      // Accumulate read-only motion signals for audio synchronization
      sumSpeed += s;
      if (s > 0.0035) {
        activeN++;
        cx += nx * s;
        cy += ny * s;
        cz += nz * s;
      }
    }

    // --- Active Particle Spatial Collision Detection & Procedural Sound Feed ---
    let collisionEnergy = 0.0;
    const colRadius = settings.particleCollisionRadius ?? 0.08;
    const colDist = colRadius * 2.0;
    const colDistSq = colDist * colDist;
    const repulsion = settings.particleRepulsionStrength ?? 0.35;

    // Collect only particles actively displaced from rest to prevent resting mesh self-collisions
    const activeIndices = activeIndicesRef.current;
    let activeCount = 0;
    for (let i = 0; i < count && activeCount < MAX_ACTIVE; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2;
      const dx = pos[ix] - rest[ix];
      const dy = pos[iy] - rest[iy];
      const dz = pos[iz] - rest[iz];
      const distFromRestSq = dx * dx + dy * dy + dz * dz;

      // Only particles disturbed away from their rest positions collide
      if (distFromRestSq > 0.0015 && scatter[i] > 0.008) {
        activeIndices[activeCount++] = i;
      }
    }

    if (activeCount > 1) {
      const gridHeads = gridHeadsRef.current;
      const gridNext = gridNextRef.current;
      gridHeads.fill(-1);

      const cellSize = colDist * 1.5;
      const invCellSize = 1.0 / cellSize;

      // Insert active particles into spatial hash grid
      for (let k = 0; k < activeCount; k++) {
        const pIdx = activeIndices[k];
        const px = pIdx * 3;
        const cx = Math.floor(pos[px] * invCellSize);
        const cy = Math.floor(pos[px + 1] * invCellSize);
        const cz = Math.floor(pos[px + 2] * invCellSize);
        const hash = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) % HASH_SIZE;

        gridNext[k] = gridHeads[hash];
        gridHeads[hash] = k;
      }

      // Query adjacent cells for collisions
      for (let k = 0; k < activeCount; k++) {
        const iIdx = activeIndices[k];
        const ix = iIdx * 3, iy = ix + 1, iz = ix + 2;
        const cx = Math.floor(pos[ix] * invCellSize);
        const cy = Math.floor(pos[iy] * invCellSize);
        const cz = Math.floor(pos[iz] * invCellSize);

        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let oz = -1; oz <= 1; oz++) {
              const neighborHash = Math.abs(
                ((cx + ox) * 73856093) ^ ((cy + oy) * 19349663) ^ ((cz + oz) * 83492791)
              ) % HASH_SIZE;

              let otherK = gridHeads[neighborHash];
              while (otherK !== -1) {
                if (otherK > k) {
                  const jIdx = activeIndices[otherK];
                  const jx = jIdx * 3, jy = jx + 1, jz = jx + 2;

                  const dx = pos[ix] - pos[jx];
                  const dy = pos[iy] - pos[jy];
                  const dz = pos[iz] - pos[jz];
                  const distSq = dx * dx + dy * dy + dz * dz;

                  if (distSq < colDistSq && distSq > 0.0000001) {
                    const dist = Math.sqrt(distSq);
                    const overlap = colDist - dist;
                    const invDist = 1.0 / dist;
                    const nx = dx * invDist;
                    const ny = dy * invDist;
                    const nz = dz * invDist;

                    // Elastic repulsion impulse to physically bounce particles apart
                    const push = overlap * repulsion;
                    vel[ix] += nx * push;
                    vel[iy] += ny * push;
                    vel[iz] += nz * push;
                    vel[jx] -= nx * push;
                    vel[jy] -= ny * push;
                    vel[jz] -= nz * push;

                    pos[ix] += nx * push * 0.5;
                    pos[iy] += ny * push * 0.5;
                    pos[iz] += nz * push * 0.5;
                    pos[jx] -= nx * push * 0.5;
                    pos[jy] -= ny * push * 0.5;
                    pos[jz] -= nz * push * 0.5;

                    // Relative velocity magnitude
                    const rvx = vel[ix] - vel[jx];
                    const rvy = vel[iy] - vel[jy];
                    const rvz = vel[iz] - vel[jz];
                    const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);

                    collisionEnergy += relSpeed * (overlap / colDist);
                  }
                }
                otherK = gridNext[otherK];
              }
            }
          }
        }
      }
    }

    // --- Motion Scatter & Scroll Proximity Audio Synchronization ---
    const REF_SPEED = 0.022;
    const frameScale = 1.0 / Math.max((delta || 0.016) * 60.0, 0.25);
    const motionEnergy = Math.min(1.0, (sumSpeed * frameScale) / (count * REF_SPEED));
    const onset = Math.max(0.0, motionEnergy - prevMotionEnergyRef.current);
    prevMotionEnergyRef.current = motionEnergy;

    // Stereo panning follows moving particle scatter centroid
    let panX = 0;
    if (sumSpeed > 0.0001 && groupRef.current) {
      audioCentroidRef.current.set(cx / sumSpeed, cy / sumSpeed, cz / sumSpeed);
      audioCentroidRef.current.applyMatrix4(groupRef.current.matrixWorld);
      audioCentroidRef.current.project(camera);
      panX = THREE.MathUtils.clamp(audioCentroidRef.current.x, -1.0, 1.0);
    } else if (isHovered) {
      panX = state.pointer.x;
    }

    // Scroll distance fade: audio fades to 0 as camera travels far from the model
    let proximity = 1.0;
    if (groupRef.current) {
      groupRef.current.getWorldPosition(audioModelPosRef.current);
      camera.getWorldPosition(audioCamPosRef.current);
      const dist = audioCamPosRef.current.distanceTo(audioModelPosRef.current);
      const nearDist = settings.particleAudioNearDistance ?? 25.0;
      const farDist = settings.particleAudioFarDistance ?? 120.0;
      proximity = 1.0 - THREE.MathUtils.smoothstep(dist, nearDist, farDist);
    }

    const flowDrive = (settings.modelFlowStrength ?? 0.15) * (settings.modelFlowSpeed ?? 0.15);
    particleSoundEngine.update({
      motionEnergy,
      activeRatio: activeN / count,
      onset,
      panX,
      ambientDrive: flowDrive,
      proximity,
    });

    pVel.multiplyScalar(0.8);

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;

    const norAttr = pointsRef.current.geometry.attributes.aNormal as THREE.BufferAttribute;
    if (norAttr) norAttr.needsUpdate = true;

    const scatterAttr = pointsRef.current.geometry.attributes.aScatter as THREE.BufferAttribute;
    if (scatterAttr) scatterAttr.needsUpdate = true;
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <sphereGeometry args={[5.0, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <points ref={pointsRef} frustumCulled={false}>
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
          defines={{ USE_ATMOSPHERE: "" }}
          transparent={true}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>

      <Html position={[0, -4.2, 0]} center distanceFactor={28} zIndexRange={[100, 0]}>
        <div className="flex items-center gap-3 bg-slate-950/85 border border-purple-500/40 backdrop-blur-xl px-4 py-2 rounded-full shadow-2xl pointer-events-auto select-none transition-all hover:border-purple-500/80">
          <button
            onClick={handlePrevModel}
            className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-500/50 hover:bg-purple-600 hover:border-purple-300 text-purple-200 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md"
            title="Previous 3D Model"
            aria-label="Previous 3D Model"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center min-w-[95px] px-1">
            <div className="flex items-center gap-1 text-[9px] font-mono text-purple-400 uppercase tracking-widest">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Morph</span>
            </div>
            <span className="text-xs font-mono font-bold text-white tracking-wider uppercase drop-shadow-md">
              {MODEL_NAMES[modelIndex]}
            </span>
          </div>

          <button
            onClick={handleNextModel}
            className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-500/50 hover:bg-purple-600 hover:border-purple-300 text-purple-200 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md"
            title="Next 3D Model"
            aria-label="Next 3D Model"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Html>
    </group>
  );
};
