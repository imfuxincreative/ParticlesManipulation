"use client";

import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { ModelParticleShader } from "@/shaders/modelShader";
import { useSimulation } from "@/context/SimulationContext";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";

const INTERACTIVE_MODELS = ["/heart.glb", "/bird.glb"];
const MODEL_NAMES = ["Heart", "Bird"];
const PARTICLE_GRID = 90;
const PARTICLE_COUNT = PARTICLE_GRID * PARTICLE_GRID;
const TARGET_SIZE = 6.0;
const MORPH_FRAMES = 600;

const ROTATION_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [0, -90, 0],
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
  rotation = [-Math.PI / 2, 0, 1.5]
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

  const isDraggingRef = useRef(false);
  const lastPointerPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const pointerVelocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentPointerLocalRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());

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

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDraggingRef.current = true;

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
      }
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    pointerVelocityRef.current.set(0, 0, 0);
  };

  const handlePointerMove = () => {
    if (!isDraggingRef.current || !groupRef.current) return;

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlaneRef.current, intersection);

    if (intersection) {
      groupRef.current.worldToLocal(intersection);
      pointerVelocityRef.current.subVectors(intersection, lastPointerPosRef.current);
      lastPointerPosRef.current.copy(intersection);
      currentPointerLocalRef.current.copy(intersection);
    }
  };

  useEffect(() => {
    const onGlobalUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("pointerup", onGlobalUp);
    window.addEventListener("pointercancel", onGlobalUp);
    return () => {
      window.removeEventListener("pointerup", onGlobalUp);
      window.removeEventListener("pointercancel", onGlobalUp);
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

  useFrame((state) => {
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

      groupRef.current.rotation.x = baseRotX + elapsed * autoSpeedX;
      groupRef.current.rotation.y = baseRotY;
      groupRef.current.rotation.z = baseRotZ;
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

    const isDragging = isDraggingRef.current;
    const pLoc = currentPointerLocalRef.current;
    const pVel = pointerVelocityRef.current;
    const pSpeed = pVel.length();

    const FLUID_RADIUS = settings.fluidDragRadius ?? 4.0;
    const FLUID_RADIUS_SQ = FLUID_RADIUS * FLUID_RADIUS;
    const dragStrength = settings.fluidDragStrength ?? 1.2;

    for (let i = 0; i < count; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2;

      if (isDragging && pSpeed > 0.001) {
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
      scatter[i] = speedSq > 0.000001 ? Math.sqrt(speedSq) : 0.0;
    }

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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        visible={false}
      >
        <sphereGeometry args={[5.0, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
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
