"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useScroll } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { ModelParticleShader } from "@/shaders/modelShader";

/**
 * WingParticles — Particle Wing System
 *
 * Extracts geometry from the "wing" node in SCENE.glb, samples points,
 * and forms the wing with 3D particles on scroll past 50%.
 * Reuses ModelParticleShader for visual styling consistency.
 */

// ─── Configuration ───
const PARTICLE_COUNT = 25000; // Denser particle count for a detailed 3D wing
const SCATTER_RADIUS = 60; // Spread radius for the scattered wings particles
const SCROLL_START = 0.5; // Gather starts at 50% scroll
const SCROLL_END = 0.58; // Fully formed by 58% scroll
const SCATTER_START = 0.65; // Remains fully formed until 65% scroll, then starts scattering again
const SCATTER_END = 0.82; // Completely scattered again by 82% scroll

interface WingParticlesProps {
  sceneIndex: number;
}

/**
 * Sample a random point inside a triangle using barycentric coordinates.
 */
function sampleTriangle(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  const w = 1 - u - v;
  out.set(
    a.x * w + b.x * u + c.x * v,
    a.y * w + b.y * u + c.y * v,
    a.z * w + b.z * u + c.z * v
  );
  return out;
}

/**
 * Compute the area of a triangle.
 */
function triangleArea(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): number {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return ab.cross(ac).length() * 0.5;
}

export const WingParticles: React.FC<WingParticlesProps> = ({
  sceneIndex,
}) => {
  const { settings } = useSimulation();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const scrollData = useScroll();
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Load the SCENE.glb containing the "wing" node (retrieved from R3F cache instantly)
  const gltf = useGLTF("/SCENE.glb");

  // Particle data state
  const [wingReady, setWingReady] = useState(false);
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const scatteredPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const dynamicPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const colorsRef = useRef<Float32Array>(new Float32Array(0));
  const scatterAmountsRef = useRef<Float32Array>(new Float32Array(0));
  const wingCenterRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const wingNodeRef = useRef<THREE.Object3D | null>(null);
  const wingScaleFactorRef = useRef<number>(1.0);

  // ─── Extract and Sample Wing Mesh ───
  useEffect(() => {
    if (!gltf) return;

    // Find the wing anchor node in the loaded GLTF hierarchy.
    // Try "mixamorigSpine2" first since the wings are attached to it.
    // NOTE: Three.js GLTFLoader strips colons from node names, so "mixamorig:Spine2" becomes "mixamorigSpine2".
    let wingNode: THREE.Object3D | null = null;
    gltf.scene.traverse((child) => {
      if (child.name.toLowerCase().includes("spine") || child.name.toLowerCase().includes("simon") || child.name.toLowerCase().includes("wing")) {
        console.log("[WingParticles debug] Node name:", child.name);
      }
      if (child.name === "mixamorigSpine2") {
        wingNode = child;
      }
    });

    if (!wingNode) {
      gltf.scene.traverse((child) => {
        if (child.name === "wing") {
          wingNode = child;
        }
      });
    }

    if (!wingNode) {
      gltf.scene.traverse((child) => {
        if (child.name === "wing1" && child.parent) {
          wingNode = child.parent;
        }
      });
    }

    if (!wingNode) {
      console.warn("[WingParticles] Wing anchor node (mixamorigSpine2 or wing) not found in SCENE.glb");
      return;
    }

    const targetNode = wingNode as THREE.Object3D;
    wingNodeRef.current = targetNode;
    console.log("[WingParticles] Anchor node found:", targetNode.name);

    // Force update world matrices for the hierarchy so we can sample points in world coordinates
    gltf.scene.updateMatrixWorld(true);
    targetNode.updateMatrixWorld(true);

    // We normalize the points group matrix to scale 1.0, so the local coordinates of the particles
    // are in world-space units. Thus, the scale factor is simply 1.0.
    wingScaleFactorRef.current = 1.0;
    console.log("[WingParticles] World scale factor (normalized):", wingScaleFactorRef.current);

    const unscaledWingMatrix = new THREE.Matrix4().copy(targetNode.matrixWorld);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    unscaledWingMatrix.decompose(position, quaternion, scale);
    unscaledWingMatrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));

    const inverseWingMatrix = new THREE.Matrix4().copy(unscaledWingMatrix).invert();

    const triangles: {
      a: THREE.Vector3;
      b: THREE.Vector3;
      c: THREE.Vector3;
      area: number;
    }[] = [];

    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();

    // Find specific wing meshes by name first, falling back to traversing the subtree
    const targetMeshNames = ["wing1", "wing2", "winghandle1", "winghandle2"];
    const wingMeshes: THREE.Mesh[] = [];

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && targetMeshNames.includes(child.name)) {
        wingMeshes.push(child);
      }
    });
    console.log("[WingParticles] Target wing meshes found:", wingMeshes.map(m => m.name));

    if (wingMeshes.length === 0) {
      // Fallback: traverse under targetNode
      targetNode.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          wingMeshes.push(child);
        }
      });
      console.log("[WingParticles] Fallback meshes found under targetNode:", wingMeshes.map(m => m.name));
    }

    // Traverse all resolved wing meshes
    wingMeshes.forEach((child) => {
      const geometry = child.geometry;
      const posAttr = geometry.attributes.position;
      const indexAttr = geometry.index;
      if (!posAttr || posAttr.count === 0) return;

      // Compute local matrix that maps from this child mesh local space
      // directly into the wingNode local space.
      const childToWingLocalMatrix = new THREE.Matrix4().multiplyMatrices(
        inverseWingMatrix,
        child.matrixWorld
      );

      const addTriangle = (ia: number, ib: number, ic: number) => {
        va.set(posAttr.getX(ia), posAttr.getY(ia), posAttr.getZ(ia)).applyMatrix4(childToWingLocalMatrix);
        vb.set(posAttr.getX(ib), posAttr.getY(ib), posAttr.getZ(ib)).applyMatrix4(childToWingLocalMatrix);
        vc.set(posAttr.getX(ic), posAttr.getY(ic), posAttr.getZ(ic)).applyMatrix4(childToWingLocalMatrix);

        const area = triangleArea(va.clone(), vb.clone(), vc.clone());
        if (area > 0.000001) {
          triangles.push({
            a: va.clone(),
            b: vb.clone(),
            c: vc.clone(),
            area,
          });
        }
      };

      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i += 3) {
          addTriangle(
            indexAttr.getX(i),
            indexAttr.getX(i + 1),
            indexAttr.getX(i + 2)
          );
        }
      } else {
        for (let i = 0; i < posAttr.count; i += 3) {
          addTriangle(i, i + 1, i + 2);
        }
      }
    });

    console.log("[WingParticles] Sampled triangles count:", triangles.length);

    if (triangles.length === 0) {
      console.warn("[WingParticles] No mesh triangles found for wings");
      return;
    }

    // Build cumulative distribution function for area-weighted sampling
    const totalArea = triangles.reduce((sum, t) => sum + t.area, 0);
    const cdf: number[] = [];
    let cumulative = 0;
    for (const tri of triangles) {
      cumulative += tri.area / totalArea;
      cdf.push(cumulative);
    }

    // Allocate particle arrays
    const targetPos = new Float32Array(PARTICLE_COUNT * 3);
    const scatteredPos = new Float32Array(PARTICLE_COUNT * 3);
    const dynamicPos = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const scatterAmts = new Float32Array(PARTICLE_COUNT);
    const point = new THREE.Vector3();

    // Calculate bounding box centroid of all target positions for the scatter center
    let cx = 0, cy = 0, cz = 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Area-weighted selection
      const r = Math.random();
      let lo = 0,
        hi = cdf.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] < r) lo = mid + 1;
        else hi = mid;
      }
      const tri = triangles[lo];

      // Sample random point on the selected triangle
      sampleTriangle(tri.a, tri.b, tri.c, point);

      targetPos[i * 3] = point.x;
      targetPos[i * 3 + 1] = point.y;
      targetPos[i * 3 + 2] = point.z;

      cx += point.x;
      cy += point.y;
      cz += point.z;
    }

    cx /= PARTICLE_COUNT;
    cy /= PARTICLE_COUNT;
    cz /= PARTICLE_COUNT;
    wingCenterRef.current.set(cx, cy, cz);

    // Populate scattered positions around the centroid
    const compensatedScatterRadius = SCATTER_RADIUS / wingScaleFactorRef.current;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = compensatedScatterRadius * (0.3 + Math.random() * 0.7);

      scatteredPos[i * 3] = cx + Math.sin(phi) * Math.cos(theta) * radius;
      scatteredPos[i * 3 + 1] = cy + Math.sin(phi) * Math.sin(theta) * radius;
      scatteredPos[i * 3 + 2] = cz + Math.cos(phi) * radius;

      // Start at scattered positions
      dynamicPos[i * 3] = scatteredPos[i * 3];
      dynamicPos[i * 3 + 1] = scatteredPos[i * 3 + 1];
      dynamicPos[i * 3 + 2] = scatteredPos[i * 3 + 2];

      // Color sentinel: -1 tells the shader to use uParticleDefaultColor
      colors[i * 3] = -1;
      colors[i * 3 + 1] = -1;
      colors[i * 3 + 2] = -1;

      scatterAmts[i] = 1.0;
    }

    targetPositionsRef.current = targetPos;
    scatteredPositionsRef.current = scatteredPos;
    dynamicPositionsRef.current = dynamicPos;
    colorsRef.current = colors;
    scatterAmountsRef.current = scatterAmts;

    setWingReady(true);
    console.log(
      `[WingParticles] Sampled ${PARTICLE_COUNT} points from wing subtree`
    );
  }, [gltf]);

  // ─── Shader Uniforms ───
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.0 }, // Disabled to prevent wing waving
      uNoiseSpeed: { value: settings.noiseSpeed },
      uPointSize: { value: settings.pointSize * 0.9 }, // Slightly smaller points for details
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
      uPrimaryColor: {
        value: new THREE.Color(settings.xrayBorderColor || "#e91e63"),
      },
      uParticleDefaultColor: {
        value: new THREE.Color(settings.xrayBorderColor || "#e91e63"),
      },
      uBurnProgress: { value: 0.0 },
      uParticleOpacity: { value: 0.0 },
      uClipY: { value: -15.0 },
      uClipSide: { value: 0.0 },
      uFlowStrength: { value: 0.0 }, // Disabled to prevent wing waving
      uFlowSpeed: { value: 0.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Sync uniforms with settings changes
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uNoiseStrength.value = 0.0; // Keep disabled to prevent wing waving
    u.uNoiseSpeed.value = settings.noiseSpeed;
    u.uPointSize.value = settings.pointSize * 0.9;
    u.uFocusDepth.value = settings.focusDepth;
    u.uFocusRange.value = settings.focusRange;
    u.uBokehScale.value = settings.bokehScale;
    u.uHazeColor.value.set(settings.hazeColor);
    u.uHazeDensity.value = settings.hazeDensity;
    u.uTint.value.set(settings.tintColor);
    u.uTintMix.value = settings.tintMix;
    u.uOpacity.value = settings.opacity;
    u.uDensityControl.value = settings.densityControl;
    u.uPrimaryColor.value.set(settings.xrayBorderColor || "#e91e63");
    u.uParticleDefaultColor.value.set(settings.xrayBorderColor || "#e91e63");
  }, [settings]);

  // ─── Per-Frame Animation Loop ───
  useFrame((state) => {
    if (!wingReady || !pointsRef.current || !scrollData) return;

    const glUserData = (state.gl as any).userData || {};
    const scrollNorms: number[] = glUserData.sceneScrollNorms || [];
    const scrollNorm = scrollNorms[sceneIndex] ?? 0.0;

    // Dynamically sync points group transform matrix with the wing node world matrix.
    // This allows the particles to track the skeletal animation of the character perfectly.
    // We normalize the scale to (1, 1, 1) so that local-space shader effects (like noise and flow)
    // are calculated relative to world-space sizes instead of scaling up/down, avoiding distortion.
    if (wingNodeRef.current && pointsRef.current) {
      wingNodeRef.current.updateMatrixWorld(true);
      const pos = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      wingNodeRef.current.matrixWorld.decompose(pos, q, s);
      pointsRef.current.matrixAutoUpdate = false;
      pointsRef.current.matrix.compose(pos, q, new THREE.Vector3(1, 1, 1));
    }

    // Calculate multi-phase gather and scatter animation state
    let eased = 0.0;
    let particleOpacity = 0.0;

    if (scrollNorm >= SCROLL_START && scrollNorm <= SCROLL_END) {
      // Phase 1: Gathering (0.0 -> 1.0)
      const progress = (scrollNorm - SCROLL_START) / (SCROLL_END - SCROLL_START);
      eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      // Fade in opacity quickly (within 2% scroll)
      particleOpacity = Math.min((scrollNorm - SCROLL_START) / 0.02, 1.0);
    } else if (scrollNorm > SCROLL_END && scrollNorm <= SCATTER_START) {
      // Phase 2: Held fully formed (1.0)
      eased = 1.0;
      particleOpacity = 1.0;
    } else if (scrollNorm > SCATTER_START && scrollNorm <= SCATTER_END) {
      // Phase 3: Scattering again (1.0 -> 0.0)
      const progress = (scrollNorm - SCATTER_START) / (SCATTER_END - SCATTER_START);
      eased = 1.0 - (1 - Math.pow(1 - progress, 3)); // Ease-out cubic to scatter
      // Smoothly fade out opacity as particles scatter
      particleOpacity = 1.0 - progress;
    } else {
      // Phase 4: Fully scattered / Hidden (0.0)
      eased = 0.0;
      particleOpacity = 0.0;
    }

    const target = targetPositionsRef.current;
    const scattered = scatteredPositionsRef.current;
    const dynamic = dynamicPositionsRef.current;
    const scatterAmts = scatterAmountsRef.current;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = ix + 1;
      const iz = ix + 2;

      // Lerp from scattered → target based on eased progress
      dynamic[ix] = scattered[ix] + (target[ix] - scattered[ix]) * eased;
      dynamic[iy] = scattered[iy] + (target[iy] - scattered[iy]) * eased;
      dynamic[iz] = scattered[iz] + (target[iz] - scattered[iz]) * eased;

      // Floating noise when not fully gathered
      if (eased < 0.98) {
        // Swirling noise effect (compensated for the parent scale)
        const noiseAmt = ((1 - eased) * 15.0) / wingScaleFactorRef.current;
        const phase = i * 0.073 + time * 0.5;
        dynamic[ix] += Math.sin(phase * 1.1) * noiseAmt;
        dynamic[iy] += Math.cos(phase * 0.9 + 1.7) * noiseAmt;
        dynamic[iz] += Math.sin(phase * 0.7 + 3.1) * noiseAmt;
      }

      // Scatter amount for glow effect
      scatterAmts[i] = (1 - eased) * 0.5;
    }

    // Upload positions to GPU
    const posAttr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    const scatterAttr = pointsRef.current.geometry.attributes
      .aScatter as THREE.BufferAttribute;
    if (scatterAttr) scatterAttr.needsUpdate = true;

    // Update shader uniforms
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uTime.value = time;
      u.uMouse.value.copy(state.pointer);
      u.uAspect.value = state.viewport.aspect;
      u.uParticleOpacity.value = particleOpacity;
    }

    // Toggle visibility based on opacity
    pointsRef.current.visible = particleOpacity > 0.001;
  });

  return (
    <>
      {/* Particle system — renders the wing as a point cloud */}
      {wingReady && (
        <points ref={pointsRef} frustumCulled={false} visible={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[dynamicPositionsRef.current, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[colorsRef.current, 3]}
            />
            <bufferAttribute
              attach="attributes-aScatter"
              args={[scatterAmountsRef.current, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={materialRef}
            vertexShader={ModelParticleShader.vertexShader}
            fragmentShader={ModelParticleShader.fragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </points>
      )}
    </>
  );
};
