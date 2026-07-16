"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { GridFloorShader } from "@/shaders/gridFloorShader";

interface GridFloorMeshSystemProps {
  meshes: THREE.Mesh[];
  projectionBounds?: { min: number; max: number };
  sceneIndex: number;
}

// Custom Grid Floor Shader optimized for GLTF meshes that might be rotated
const CustomGridFloorShader = {
  vertexShader: `
    uniform float uTileSize;
    attribute vec2 aTileIndex;
    attribute vec2 aInstanceXZ;
    attribute float aFallProgress;

    varying vec2 vPlaneCoords;
    varying vec3 vWorldPosition;
    varying float vDepth;
    varying float vFallProgress;
    
    void main() {
      vFallProgress = aFallProgress;

      // Calculate world position including instanceMatrix if instanced
      #ifdef USE_INSTANCING
        vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
      #else
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      #endif
      vWorldPosition = worldPosition.xyz;
      
      // Calculate view-space depth
      vec4 mvPosition = viewMatrix * worldPosition;
      vDepth = -mvPosition.z;
      
      // Calculate plane coordinates scaled to world units
      #ifdef USE_INSTANCING
        // Use the tile grid index to align grid lines perfectly to the instance boundaries
        // position.xz ranges from -0.5 to 0.5. Adding 0.5 shifts it to 0.0 to 1.0.
        // We scale by uTileSize to make the tile span exactly one grid spacing.
        vPlaneCoords = (aTileIndex + vec2(position.x, position.z) + 0.5) * uTileSize;
      #else
        float scaleX = length(vec3(modelMatrix[0][0], modelMatrix[0][1], modelMatrix[0][2]));
        float scaleZ = length(vec3(modelMatrix[2][0], modelMatrix[2][1], modelMatrix[2][2]));
        vPlaneCoords = vec2(position.x * scaleX, position.z * scaleZ);
      #endif
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uGlowIntensity;
    uniform float uOpacity;
    uniform float uDepthLimit;
    uniform float uFadeZone;
    uniform float uTileSize;
    uniform float uLineWidth;
    
    uniform vec3 uBaseColor;
    
    uniform float uShowFog;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uFogAmount;
    uniform float uFillOpacity;
    uniform float uBurnOut;
    uniform float uSolidDepthLimit;
    uniform vec3 uWipeDirection;
    uniform float uMinProj;
    uniform float uMaxProj;
    
    varying vec2 vPlaneCoords;
    varying vec3 vWorldPosition;
    varying float vDepth;
    varying float vFallProgress;
    
    void main() {
      // Calculate side-sweeping wipe progress in world space
      float proj = dot(vWorldPosition.xyz, uWipeDirection);
      float progress = clamp((proj - uMinProj) / (uMaxProj - uMinProj), 0.0, 1.0);
      
      // Smooth opacity transition zone
      float transitionWidth = 0.1;
      float wipeProgress = uBurnOut * 1.25 - 0.1;
      float alphaFactor = smoothstep(wipeProgress, wipeProgress + transitionWidth, progress);

      // 1. Calculate Grid Lines (using local plane coordinates scaled to world units)
      vec2 localCoord = abs(fract(vPlaneCoords / uTileSize - 0.5) - 0.5) * uTileSize;
      vec2 gridDeriv = fwidth(vPlaneCoords);
      vec2 thickness = max(vec2(0.04), uLineWidth * gridDeriv);
      vec2 lineVal = 1.0 - smoothstep(vec2(0.0), thickness, localCoord);
      float lineStrength = max(lineVal.x, lineVal.y);
      
      // 2. Add a soft grid cell/tiled fill pattern (chessboard)
      vec2 tileIndex = floor(vPlaneCoords / uTileSize);
      float tileCheck = mod(abs(tileIndex.x + tileIndex.y), 2.0);
      bool isOdd = tileCheck < 0.5;
      float cellFill = isOdd ? uFillOpacity : 0.0;
      
      // 3. X-Ray Reveal (Depth-based) - ONLY applies to grid lines
      float fadeStart = max(0.0, uDepthLimit - uFadeZone);
      float xrayAlpha = 1.0 - smoothstep(fadeStart, uDepthLimit, vDepth);
      float lineAlpha = lineStrength * xrayAlpha * uOpacity;
      
      // Chessboard tiles are always visible
      float tileAlpha = cellFill * (1.0 - lineStrength);
      
      vec3 baseGridColor = mix(uBaseColor, uColor * uGlowIntensity, lineStrength);
      float baseGridAlpha = max(lineAlpha, tileAlpha);
      
      // Scanline aligned with local plane rows (y direction of vPlaneCoords)
      float scanline = sin(vPlaneCoords.y * 2.0 - uTime * 3.0) * 0.5 + 0.5;
      baseGridColor = mix(baseGridColor, baseGridColor * 1.3, scanline * lineStrength * 0.3);
      
      // Apply fall progress fade
      float finalAlpha = baseGridAlpha * alphaFactor * (1.0 - vFallProgress);
      
      // Apply environmental fog
      float fogFactor = clamp((uFogFar - vDepth) / max(uFogFar - uFogNear, 0.0001), 0.0, 1.0);
      float fogMix = uShowFog * uFogAmount * (1.0 - fogFactor);
      baseGridColor = mix(baseGridColor, uFogColor, fogMix);
      finalAlpha = mix(finalAlpha, 0.0, fogMix);

      if (finalAlpha < 0.001) discard;
      
      gl_FragColor = vec4(baseGridColor, finalAlpha);
    }
  `
};

export const GridFloorMeshSystem: React.FC<GridFloorMeshSystemProps> = ({
  meshes,
  projectionBounds,
  sceneIndex,
}) => {
  const { settings } = useSimulation();

  // Create the shared custom Grid Floor shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: CustomGridFloorShader.vertexShader,
      fragmentShader: CustomGridFloorShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(GridFloorShader.uniforms),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  // Track the current animated depth value
  const animState = useMemo(
    () => ({
      currentDepth: settings.xrayBorderRevealDepth ?? 40.0,
      currentSolidDepth: settings.xraySolidRevealDepth ?? 200.0,
    }),
    []
  );

  // Sync settings reactively to uniforms
  useEffect(() => {
    const u = material.uniforms;

    u.uColor.value.set(settings.xrayBorderColor || "#e91e63");
    u.uGlowIntensity.value = settings.xrayLineGlowIntensity ?? 2.5;
    u.uOpacity.value = settings.gridFloorOpacity ?? 0.35;
    u.uTileSize.value = settings.gridTileSize ?? 4.0;
    u.uLineWidth.value = settings.gridLineWidth ?? 1.5;

    u.uBaseColor.value.set(settings.xrayBaseColor || "#888888");
    u.uFillOpacity.value = settings.gridFloorFillOpacity ?? 0.15;

    // Sync fog settings
    if (u.uShowFog) u.uShowFog.value = settings.showFog ? 1.0 : 0.0;
    if (u.uFogColor) u.uFogColor.value.set(settings.fogColor);
    if (u.uFogNear) u.uFogNear.value = settings.fogNear;
    if (u.uFogFar) u.uFogFar.value = settings.fogFar;
    if (u.uFogAmount) u.uFogAmount.value = settings.fogAmount;

    // Sync sweep boundaries
    if (projectionBounds) {
      u.uMinProj.value = projectionBounds.min;
      u.uMaxProj.value = projectionBounds.max;
    }
  }, [
    settings.xrayBorderColor,
    settings.xrayLineGlowIntensity,
    settings.gridFloorOpacity,
    settings.gridTileSize,
    settings.gridLineWidth,
    settings.xrayBaseColor,
    settings.gridFloorFillOpacity,
    settings.showFog,
    settings.fogColor,
    settings.fogNear,
    settings.fogFar,
    settings.fogAmount,
    projectionBounds,
    material,
  ]);

  // Split meshes: falling tiles effect for meshes with "floor" in name, flat grid for everything else
  const { fallingMeshes, flatMeshes } = useMemo(() => {
    const falling: THREE.Mesh[] = [];
    const flat: THREE.Mesh[] = [];
    meshes.forEach((m) => {
      if (m.name.toLowerCase().includes("floor")) {
        falling.push(m);
      } else {
        flat.push(m);
      }
    });
    return { fallingMeshes: falling, flatMeshes: flat };
  }, [meshes]);

  // Find the primary falling mesh
  const fallingMesh = useMemo(() => {
    return fallingMeshes.find((m) => m !== undefined) || null;
  }, [fallingMeshes]);

  // Render flat meshes normally (hologram grid lines, no falling effect)
  useEffect(() => {
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

    flatMeshes.forEach((mesh) => {
      if (!mesh) return;
      originalMaterials.set(mesh, mesh.material);

      mesh.material = material;
      mesh.visible = true;
      mesh.frustumCulled = false;
    });

    return () => {
      flatMeshes.forEach((mesh) => {
        if (!mesh) return;
        if (originalMaterials.has(mesh)) {
          mesh.material = originalMaterials.get(mesh)!;
        }
        mesh.visible = false;
      });
    };
  }, [flatMeshes, material]);

  // Hide the original falling GLTF floor meshes since we are replacing them with instanced tiles
  useEffect(() => {
    fallingMeshes.forEach((mesh) => {
      if (!mesh) return;
      mesh.visible = false;
    });

    return () => {
      fallingMeshes.forEach((mesh) => {
        if (!mesh) return;
        mesh.visible = true;
      });
    };
  }, [fallingMeshes]);

  // Dynamically calculate grid parameters and create the InstancedMesh
  const gridData = useMemo(() => {
    if (!fallingMesh) return null;

    // Use a flat template geometry of size 1x1 lying flat on XZ plane
    const localGeo = new THREE.PlaneGeometry(1, 1);
    localGeo.rotateX(-Math.PI / 2);

    // Calculate local bounds dimensions in world coordinates (using scale)
    const worldWidth = fallingMesh.scale.x * 2.0;
    const worldDepth = fallingMesh.scale.z * 2.0;

    const tileSize = settings.gridTileSize ?? 4.0;

    // Calculate grid dimensions
    const cols = Math.ceil(worldWidth / tileSize);
    const rows = Math.ceil(worldDepth / tileSize);
    const count = cols * rows;

    const geo = new THREE.InstancedBufferGeometry().copy(localGeo as any);

    // Grid sizes in local units (from -1 to 1, total length of 2)
    const localTileSizeX = 2.0 / cols;
    const localTileSizeZ = 2.0 / rows;

    const initialXZ = new Float32Array(count * 2);
    const tileIndexData = new Float32Array(count * 2);
    const tiles = [];

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Local coordinates
        const lx = -1.0 + (c + 0.5) * localTileSizeX;
        const lz = -1.0 + (r + 0.5) * localTileSizeZ;

        // Pre-scale initial coordinate to world units for continuous mapping in vertex shader
        initialXZ[idx * 2] = lx * fallingMesh.scale.x;
        initialXZ[idx * 2 + 1] = lz * fallingMesh.scale.z;

        tileIndexData[idx * 2] = c;
        tileIndexData[idx * 2 + 1] = r;

        tiles.push({
          lx,
          lz,
          // Pre-scaled world coordinates for camera distance calculations
          wx: lx * fallingMesh.scale.x,
          wz: lz * fallingMesh.scale.z,
          randomThreshold: Math.random(),
          randomSpeed: 0.5 + Math.random() * 1.5,
          randomRotX: (Math.random() - 0.5) * 2.0,
          randomRotZ: (Math.random() - 0.5) * 2.0,
          randomRotY: (Math.random() - 0.5) * 1.0,
        });
        idx++;
      }
    }

    geo.setAttribute(
      "aInstanceXZ",
      new THREE.InstancedBufferAttribute(initialXZ, 2)
    );

    geo.setAttribute(
      "aTileIndex",
      new THREE.InstancedBufferAttribute(tileIndexData, 2)
    );

    const fallProgressArray = new Float32Array(count);
    geo.setAttribute(
      "aFallProgress",
      new THREE.InstancedBufferAttribute(fallProgressArray, 1)
    );

    const imesh = new THREE.InstancedMesh(geo, material, count);
    imesh.frustumCulled = false;

    // Apply exact local transforms from GLTF floor mesh to align it perfectly
    imesh.position.copy(fallingMesh.position);
    imesh.rotation.copy(fallingMesh.rotation);
    imesh.scale.copy(fallingMesh.scale);

    return {
      imesh,
      tiles,
      localTileSizeX,
      localTileSizeZ,
      count,
    };
  }, [fallingMesh, settings.gridTileSize, material]);

  // Handle adding the InstancedMesh directly to the original GLTF floor parent
  useEffect(() => {
    if (!fallingMesh || !gridData) return;
    const parent = fallingMesh.parent;
    if (parent) {
      parent.add(gridData.imesh);
      return () => {
        parent.remove(gridData.imesh);
      };
    }
  }, [fallingMesh, gridData]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Update animated uniforms and instance transforms in frame loop
  useFrame((state, delta) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // Active only if it's the active scene or the incoming transition scene
    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);
    if (!isVisible) return;

    const u = material.uniforms;

    // Time uniform
    u.uTime.value = state.clock.elapsedTime;

    // Target depths reveal
    const targetDepth = settings.xrayBorderRevealDepth ?? 40.0;
    const targetSolidDepth = settings.xraySolidRevealDepth ?? 200.0;

    // Smooth lerp reveal depths
    const lerpSpeed = 1.0 - Math.exp(-delta / 0.2);
    animState.currentDepth += (targetDepth - animState.currentDepth) * lerpSpeed;
    animState.currentSolidDepth += (targetSolidDepth - animState.currentSolidDepth) * lerpSpeed;

    if (u.uDepthLimit) u.uDepthLimit.value = animState.currentDepth;
    if (u.uSolidDepthLimit) u.uSolidDepthLimit.value = animState.currentSolidDepth;

    // Scroll Burnout
    const burnOut = 0.0;
    if (u.uBurnOut) u.uBurnOut.value = burnOut;

    // Apply scroll overrides and fog overrides in the frame loop
    const vis = glUserData.sceneVisuals || {};

    const borderGlowColor = vis.xrayBorderColor ?? settings.xrayBorderColor;
    const baseFillColor = vis.xrayBaseColor ?? settings.xrayBaseColor;
    const lineOpacity = vis.gridFloorOpacity ?? settings.gridFloorOpacity ?? 0.35;

    u.uColor.value.set(borderGlowColor || "#e91e63");
    u.uBaseColor.value.set(baseFillColor || "#888888");
    u.uOpacity.value = lineOpacity;

    const showFogVal = vis.showFog !== undefined ? vis.showFog : settings.showFog;
    const fogColorVal = vis.fogColor ?? settings.fogColor;
    const fogNearVal = vis.fogNear !== undefined ? vis.fogNear : settings.fogNear;
    const fogFarVal = vis.fogFar !== undefined ? vis.fogFar : settings.fogFar;
    const fogAmountVal = vis.fogAmount !== undefined ? vis.fogAmount : settings.fogAmount;

    if (u.uShowFog) u.uShowFog.value = showFogVal ? 1.0 : 0.0;
    if (u.uFogColor) u.uFogColor.value.set(fogColorVal);
    if (u.uFogNear) u.uFogNear.value = fogNearVal;
    if (u.uFogFar) u.uFogFar.value = fogFarVal;
    if (u.uFogAmount) u.uFogAmount.value = fogAmountVal;

    // Update instance positions, rotations, and fall progress based on camera distance
    if (fallingMesh && gridData) {
      const imesh = gridData.imesh;
      const { tiles, localTileSizeX, localTileSizeZ } = gridData;

      // Force update of matrixWorld to ensure worldToLocal is accurate
      imesh.updateMatrixWorld(true);

      // Transform camera position to local coordinate space of the floor mesh
      const localCamera = new THREE.Vector3().copy(state.camera.position);
      imesh.worldToLocal(localCamera);

      const fallRadius = settings.gridFloorFallRadius ?? 40.0;
      const fallRadiusRange = settings.gridFloorFallRadiusRange ?? 20.0;
      const maxFallDist = settings.gridFloorFallMaxDistance ?? 35.0;
      const fallRandomness = settings.gridFloorFallRandomness ?? 12.0;

      const fallAttr = imesh.geometry.getAttribute("aFallProgress") as THREE.InstancedBufferAttribute;

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];

        // Horizontal distance along the floor plane in world units
        const dx = tile.wx - (localCamera.x * fallingMesh.scale.x);
        const dz = tile.wz - (localCamera.z * fallingMesh.scale.z);
        const distWorld = Math.sqrt(dx * dx + dz * dz);

        // Randomized activation distance for natural, jagged fall edge
        const activationDist = fallRadius + (tile.randomThreshold - 0.5) * fallRandomness;

        let fallProgress = 0;
        if (distWorld < activationDist) {
          const rawProgress = (activationDist - distWorld) / fallRadiusRange;
          fallProgress = Math.max(0, Math.min(1, rawProgress));
        }

        const easedProgress = fallProgress * fallProgress * fallProgress; // Cubic ease-in

        // Apply translation, rotation, and scale in local space
        // Fall down along the local Y axis (normal direction of the floor mesh)
        const targetLocalY = -easedProgress * (maxFallDist / fallingMesh.scale.y) * tile.randomSpeed;
        const rotX = tile.randomRotX * easedProgress * 1.2;
        const rotY = tile.randomRotY * easedProgress * 0.6;
        const rotZ = tile.randomRotZ * easedProgress * 1.2;

        dummy.position.set(tile.lx, targetLocalY, tile.lz);
        dummy.rotation.set(rotX, rotY, rotZ);
        dummy.scale.set(localTileSizeX * 0.96, 1.0, localTileSizeZ * 0.96);
        dummy.updateMatrix();

        imesh.setMatrixAt(i, dummy.matrix);

        // Update the instanced fall progress attribute
        if (fallAttr) {
          fallAttr.setX(i, easedProgress);
        }
      }

      imesh.instanceMatrix.needsUpdate = true;
      if (fallAttr) {
        fallAttr.needsUpdate = true;
      }
    }
  });

  return null;
};
